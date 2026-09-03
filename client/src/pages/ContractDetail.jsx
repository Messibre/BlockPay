import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@meshsdk/react";
import {
  resolvePaymentKeyHash,
  resolvePlutusScriptAddress,
} from "@meshsdk/core";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import api from "../services/api.js";
import WalletPicker from "../components/WalletPicker.jsx";
import Modal from "../components/Modal.jsx";
import BackButton from "../components/BackButton.jsx";
import {
  buildDepositTransaction,
  buildReleaseTransaction,
  buildRefundTransaction,
  buildWithdrawTransaction,
  lovelaceToAda,
  findEscrowUtxo,
} from "../utils/transactions.js";
import { BlockfrostProvider } from "@meshsdk/core";
import { contractScript } from "../constants/script";
import styles from "./ContractDetail.module.css";

export default function ContractDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { wallet, connected, address } = useWallet();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const refreshContract = () =>
    queryClient.invalidateQueries({
      queryKey: ["contract", id],
      exact: true,
    });
  const [isDepositing, setIsDepositing] = useState(false);
  const [isApproving, setIsApproving] = useState({});
  const [isWalletPickerOpen, setIsWalletPickerOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  // Submission modal state (declared here to preserve hook order across renders)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  // Refund / Withdraw state
  const [isRefunding, setIsRefunding] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState({});

  const {
    data: contract,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => api.getContract(id),
    retry: 1,
    // Only attempt fetch when user is authenticated (API requires auth)
    enabled: !!localStorage.getItem("token") || isAuthenticated,
  });

  // While a deposit is PENDING on-chain, poll the backend which re-verifies
  // it against Blockfrost and flips the contract to FUNDED once confirmed.
  const hasPendingDeposit =
    contract?.offchainState === "PENDING" &&
    (contract?.deposits || []).some((d) => d.status === "PENDING");
  useQuery({
    queryKey: ["deposit-status", id],
    queryFn: async () => {
      const data = await api.verifyDepositStatus(id);
      if (data.offchainState !== "PENDING") {
        refreshContract();
      }
      return data;
    },
    enabled: hasPendingDeposit,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <p>Loading contract details...</p>
      </div>
    );
  }

  if (error || (!contract && isAuthenticated)) {
    return (
      <div className={styles.errorContainer}>
        <h2>Contract not found</h2>
        <p>
          {error?.response?.status === 404
            ? "This contract doesn't exist or has been removed."
            : "Unable to load contract. Please try again later."}
        </p>
        <Link to="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const isClient = user?.role === "client";
  const isFreelancer = user?.role === "freelancer";
  const needsDeposit =
    isClient && contract && contract.offchainState === "PENDING";
  const isFunded =
    contract?.offchainState === "FUNDED" ||
    contract?.offchainState === "ACTIVE";

  // Try to find address in this order:
  // 1. Contract object itself (if saved)
  // 2. Constants/Env variable
  // 3. Derived from CBOR (Fallback)

  let scriptAddress = null;
  try {
    const scriptObject = { code: contractScript.cbor, version: "V3" };
    scriptAddress = resolvePlutusScriptAddress(scriptObject, 0);
  } catch (error) {
    console.error("Failed to derive script address from CBOR:", error);
    scriptAddress =
      contractScript.address || import.meta.env.VITE_ESCROW_SCRIPT_ADDRESS;
  }

  const handleDeposit = async () => {
    if (!connected || !wallet) {
      showError("Please connect your wallet first");
      return;
    }

    // Open wallet picker first
    setIsWalletPickerOpen(true);
  };

  const onWalletSelected = async (addr) => {
    setIsWalletPickerOpen(false);
    if (!addr) return;
    setSelectedWallet(addr);

    // If selected matches connected, proceed
    if (addr === address) {
      await proceedWithDeposit(addr, null);
      return;
    }

    // If user selected a different saved wallet, ask them to switch or link
    setIsSwitchModalOpen(true);
  };

  const proceedWithDeposit = async (signerAddr, signerSignature) => {
    setIsDepositing(true);
    try {
      // Basic address validator
      const isBech32 = (s) =>
        typeof s === "string" &&
        /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
        s.length >= 8;

      // Resolve/validate addresses with sensible fallbacks
      const clientAddr = isBech32(contract.datum?.client)
        ? contract.datum.client
        : isBech32(address)
          ? address
          : null;

      if (!clientAddr) {
        showError(
          "Invalid client address on contract. Connect wallet or fix contract data.",
        );
        setIsDepositing(false);
        return;
      }

      const freelancerAddr = isBech32(contract.datum?.freelancer)
        ? contract.datum.freelancer
        : isBech32(contract.freelancerId?.walletAddress)
          ? contract.freelancerId.walletAddress
          : null;

      if (!freelancerAddr) {
        showError(
          "Invalid freelancer address on contract. Please check freelancer settings.",
        );
        setIsDepositing(false);
        return;
      }

      const feeAddr = isBech32(contract.datum?.feeAddress)
        ? contract.datum?.feeAddress
        : isBech32(address)
          ? address
          : null;

      const arbitratorAddr = isBech32(contract.datum?.arbitrator)
        ? contract.datum?.arbitrator
        : isBech32(address)
          ? address
          : null;

      // The contract nonce MUST be the backend-stored value: the release flow
      // rebuilds this exact datum from contract.datum.contractNonce, and any
      // difference makes the on-chain datum unmatchable (funds unreachable).
      if (!contract.datum?.contractNonce) {
        throw new Error(
          "Contract is missing its on-chain nonce (datum.contractNonce). " +
            "Cannot deposit safely - contact support.",
        );
      }

      // Build the escrow datum
      const datum = {
        client: clientAddr,
        freelancer: freelancerAddr,
        total_amount: contract.totalAmount,
        milestones:
          contract.datum?.milestones ||
          (contract.milestones || []).map((m) => ({
            id: m.id,
            amount: m.amount,
            paid: false,
          })),
        contract_nonce: contract.datum.contractNonce,
        fee_percent: contract.datum?.feePercent || 100, // Default 1% (100 basis points)
        fee_address: feeAddr,
        expiration: contract.datum?.expiration || null,
        arbitrator: arbitratorAddr,
      };

      // Build and submit deposit transaction
      const txHash = await buildDepositTransaction(
        wallet,
        scriptAddress,
        contract.totalAmount,
        datum,
      );

      // Record deposit with backend (include signer info if present)
      await api.recordDeposit(
        id,
        txHash,
        contract.totalAmount,
        signerAddr,
        signerSignature,
      );

      success(
        `Deposit submitted (TX: ${txHash.slice(0, 16)}...). Waiting for on-chain confirmation...`,
      );
      refreshContract();
    } catch (error) {
      console.error("Deposit error:", error);
      const serverMessage = error.response?.data?.message;
      const serverError = error.response?.data?.error;
      const explorerLink = error.response?.data?.explorerLink;
      const verification = error.response?.data?.verification;
      const detail = serverMessage || serverError || error.message;
      // Show concise message to user, but log full verification details for debugging
      showError(detail || "Failed to deposit funds. Please try again.");
      if (explorerLink) console.info("TX explorer:", explorerLink);
      if (verification)
        console.info("Deposit verification details:", verification);
    } finally {
      setIsDepositing(false);
      setSelectedWallet(null);
    }
  };

  const trySwitchingWallet = async () => {
    // Check current address; if matches selectedWallet, proceed
    if (address === selectedWallet) {
      setIsSwitchModalOpen(false);
      await proceedWithDeposit(address, null);
      return;
    }

    // Otherwise prompt user to switch in their extension
    showError(
      'Please switch the active account in your wallet extension, then click "I switched"',
    );
  };

  const signAndLinkCurrent = async () => {
    if (!wallet || !address) {
      showError("Connect your wallet first");
      return;
    }
    setIsLinking(true);
    try {
      const message = `Link blockPay account at ${Date.now()}`;
      // sign message using CIP-30 signData (payload as hex)
      const encoder = new TextEncoder();
      const payloadHex = Array.from(encoder.encode(message))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const sigObj = await wallet.signData(address, payloadHex);
      const signature = sigObj?.signature || sigObj; // some wallets return object

      // Call verify endpoint to link
      const res = await api.verifyWallet(address, signature, message);
      // Update auth (token + user)
      const newToken = res.token;
      localStorage.setItem("token", newToken);
      // Force a page refresh of auth context by reloading (or call a login method if available)
      window.location.reload();

      // Proceed with deposit using connected wallet
      setIsSwitchModalOpen(false);
      await proceedWithDeposit(address, signature);
    } catch (e) {
      console.error("Sign & link failed", e);
      showError(
        e.response?.data?.message ||
          e.message ||
          "Failed to sign & link wallet",
      );
    } finally {
      setIsLinking(false);
    }
  };

  const handleApproveMilestone = async (milestoneId) => {
    if (!connected || !wallet) {
      showError("Please connect your wallet first");
      return;
    }

    setIsApproving({ ...isApproving, [milestoneId]: true });
    // If a release tx for this milestone was already submitted on-chain but
    // the backend failed to record it (e.g. it was down or rejected the
    // recording), retry ONLY the recording - never build a second release
    // transaction for the same milestone.
    const pendingKey = `pendingRelease:${id}:${milestoneId}`;
    const recordReleaseWithRetry = async (txHash) => {
      const maxAttempts = 6;
      const retryDelayMs = 5_000;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await api.approveMilestone(id, milestoneId, txHash);
        } catch (recordingError) {
          const isPending =
            recordingError.response?.status === 202 ||
            recordingError.response?.data?.status === "PENDING";
          if (!isPending) throw recordingError;
          if (attempt === maxAttempts) {
            const pendingError = new Error(
              "Release submitted successfully and is still being indexed. Please retry shortly; no new payment will be made.",
            );
            pendingError.code = "RELEASE_INDEXING";
            throw pendingError;
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    };

    try {
      const pendingTxHash = localStorage.getItem(pendingKey);
      if (pendingTxHash) {
        await recordReleaseWithRetry(pendingTxHash);
        localStorage.removeItem(pendingKey);
        success(
          `Milestone release recorded! TX: ${pendingTxHash.slice(0, 16)}...`,
        );
        refreshContract();
        return;
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        throw new Error("Milestone not found");
      }

      const scriptAddress = contract.contractAddress;
      const isBech32 = (value) =>
        typeof value === "string" &&
        /^(addr1|addr_test1)[0-9a-z]+$/.test(value) &&
        value.length >= 8;
      const hashMatches = (candidate, expectedHash) =>
        isBech32(candidate) &&
        resolvePaymentKeyHash(candidate).toLowerCase() ===
          String(expectedHash).toLowerCase();

      const clientAddr = isBech32(contract.datum?.client)
        ? contract.datum.client
        : isBech32(address)
          ? address
          : null;
      const freelancerAddr = isBech32(contract.datum?.freelancer)
        ? contract.datum.freelancer
        : isBech32(contract.freelancerId?.walletAddress)
          ? contract.freelancerId.walletAddress
          : null;
      if (!clientAddr) throw new Error("Invalid client address on contract");
      if (!freelancerAddr)
        throw new Error("Invalid freelancer address on contract");
      if (!contract.datum?.contractNonce) {
        throw new Error(
          "Contract is missing its on-chain nonce (datum.contractNonce).",
        );
      }

      const blockfrostProvider = new BlockfrostProvider(
        import.meta.env.VITE_BLOCKFROST_KEY,
      );
      let onChainUtxos = [];
      try {
        onChainUtxos =
          await blockfrostProvider.fetchAddressUTxOs(scriptAddress);
      } catch {
        onChainUtxos = await blockfrostProvider.fetchUtxos(scriptAddress);
      }
      if (!onChainUtxos?.length) {
        throw new Error(`No escrow funds found at ${scriptAddress}.`);
      }

      // The selected UTxO's decoded inline datum is authoritative. Mongo can
      // lag a confirmed release, and deposit hashes do not identify the
      // continuation output created by later releases.
      const rawUtxo = findEscrowUtxo(onChainUtxos, {
        milestoneId,
        clientAddress: clientAddr,
        contractNonce: contract.datum.contractNonce,
      });
      if (!rawUtxo) {
        throw new Error(
          "No current escrow UTxO matches this contract nonce and client.",
        );
      }

      const chainDatum = rawUtxo.escrowDatum;
      if (!hashMatches(clientAddr, chainDatum.clientHash)) {
        throw new Error("Client address does not match the on-chain datum.");
      }
      if (!hashMatches(freelancerAddr, chainDatum.freelancerHash)) {
        throw new Error(
          "Freelancer address does not match the on-chain datum.",
        );
      }
      if (chainDatum.total_amount !== Number(contract.totalAmount)) {
        throw new Error("Backend and on-chain contract totals do not match.");
      }

      const backendMilestones = new Map(
        contract.milestones.map((item) => [item.id, Number(item.amount)]),
      );
      if (
        chainDatum.milestones.length !== backendMilestones.size ||
        chainDatum.milestones.some(
          (item) => backendMilestones.get(item.id) !== item.amount,
        )
      ) {
        throw new Error(
          "Backend and on-chain milestone identities or amounts do not match.",
        );
      }

      const chainMilestone = chainDatum.milestones.find(
        (item) => item.id === milestoneId,
      );
      if (!chainMilestone) {
        throw new Error("Milestone is missing from the on-chain datum.");
      }

      const currentTxHash = rawUtxo.txHash || rawUtxo.input?.txHash;
      if (chainMilestone.paid) {
        // The chain already accepted this release while Mongo remained stale.
        // Reconcile that confirmed transaction instead of submitting a
        // duplicate Release that the validator must reject.
        await recordReleaseWithRetry(currentTxHash);
        localStorage.removeItem(pendingKey);
        success(
          `Confirmed release reconciled! TX: ${currentTxHash.slice(0, 16)}...`,
        );
        refreshContract();
        return;
      }

      const addressCandidates = [
        contract.datum?.feeAddress,
        clientAddr,
        address,
      ].filter(Boolean);
      const feeAddress = addressCandidates.find((candidate) =>
        hashMatches(candidate, chainDatum.feeAddressHash),
      );
      const arbitratorAddress = [contract.datum?.arbitrator, clientAddr].find(
        (candidate) => hashMatches(candidate, chainDatum.arbitratorHash),
      );
      if (!feeAddress || !arbitratorAddress) {
        throw new Error(
          "Could not map the on-chain fee or arbitrator hash to a known address.",
        );
      }

      const currentDatum = {
        client: clientAddr,
        freelancer: freelancerAddr,
        total_amount: chainDatum.total_amount,
        milestones: chainDatum.milestones,
        contract_nonce: chainDatum.contract_nonce,
        fee_percent: chainDatum.fee_percent,
        fee_address: feeAddress,
        expiration: chainDatum.expiration,
        arbitrator: arbitratorAddress,
      };
      const newDatum = {
        ...currentDatum,
        milestones: currentDatum.milestones.map((item) =>
          item.id === milestoneId ? { ...item, paid: true } : item,
        ),
      };

      const formattedUtxo = {
        input: {
          txHash: currentTxHash,
          outputIndex: rawUtxo.outputIndex ?? rawUtxo.input?.outputIndex,
        },
        output: {
          address: scriptAddress,
          amount: rawUtxo.amount || rawUtxo.output?.amount,
        },
      };
      const inputLovelace = Number(
        formattedUtxo.output.amount?.find((item) => item.unit === "lovelace")
          ?.quantity || 0,
      );
      const milestoneAmount = chainMilestone.amount;
      const feeAmount = Math.floor(
        (milestoneAmount * chainDatum.fee_percent) / 10000,
      );
      const payoutAmount = milestoneAmount - feeAmount;
      const remainingAmount = inputLovelace - milestoneAmount;
      if (inputLovelace < milestoneAmount || remainingAmount < 0) {
        throw new Error("Escrow UTxO does not contain this milestone's funds.");
      }

      const txHash = await buildReleaseTransaction(
        wallet,
        scriptAddress,
        milestoneId,
        currentDatum,
        newDatum,
        payoutAmount,
        freelancerAddr,
        remainingAmount,
        formattedUtxo,
        feeAddress,
        feeAmount,
      );

      // The tx is now on-chain. Persist the hash BEFORE recording with the
      // backend so a recording failure can be retried without rebuilding
      // (and double-spending) the release transaction.
      localStorage.setItem(pendingKey, txHash);

      // 7. Record release with backend. A pending verification is retried
      // without rebuilding or resubmitting the on-chain release.
      await recordReleaseWithRetry(txHash);
      localStorage.removeItem(pendingKey);

      success(`Milestone approved & released! TX: ${txHash.slice(0, 16)}...`);
      refreshContract();
    } catch (error) {
      console.error("Approve error:", error);
      // Prefer backend-provided message/details for clarity
      const resp = error.response?.data;
      const details = resp?.details ? resp.details.join("; ") : null;
      let msg =
        details ||
        resp?.message ||
        error.message ||
        "Failed to approve milestone";
      // If the on-chain release succeeded but backend recording failed, make
      // clear the funds already moved and a retry will only re-record.
      if (localStorage.getItem(pendingKey)) {
        msg =
          error.code === "RELEASE_INDEXING"
            ? error.message
            : `The payment was released on-chain, but recording it failed: ${msg} - click Approve again to retry recording (no new payment will be made).`;
      }
      showError(msg);
      // Log full response for debugging
       
      console.error("Approve error response:", resp || error);
    } finally {
      setIsApproving({ ...isApproving, [milestoneId]: false });
    }
  };

  const openSubmitModal = (milestone) => {
    setSelectedMilestone(milestone);
    setSubmissionNote("");
    setIsSubmitModalOpen(true);
  };

  const handleSubmitWork = async () => {
    if (!selectedMilestone) return;

    try {
      await api.submitMilestone(id, selectedMilestone.id, {
        description: submissionNote,
      });
      success("Work submitted for review!");
      refreshContract();
      setIsSubmitModalOpen(false);
    } catch (error) {
      console.error("Submit work error:", error);
      showError(error.response?.data?.message || "Failed to submit work");
    }
  };

  // Shared recovery locator. It uses the selected UTxO's decoded datum rather
  // than Mongo state, exactly like approval, so paid flags cannot regress.
  const locateEscrowUtxo = async (milestoneId = null) => {
    const isBech32 = (value) =>
      typeof value === "string" &&
      /^(addr1|addr_test1)[0-9a-z]+$/.test(value) &&
      value.length >= 8;
    const hashMatches = (candidate, expectedHash) =>
      isBech32(candidate) &&
      resolvePaymentKeyHash(candidate).toLowerCase() ===
        String(expectedHash).toLowerCase();

    const clientAddr = isBech32(contract.datum?.client)
      ? contract.datum.client
      : null;
    const freelancerAddr = isBech32(contract.datum?.freelancer)
      ? contract.datum.freelancer
      : isBech32(contract.freelancerId?.walletAddress)
        ? contract.freelancerId.walletAddress
        : null;
    if (!clientAddr) throw new Error("Invalid client address on contract");
    if (!freelancerAddr)
      throw new Error("Invalid freelancer address on contract");
    if (!contract.datum?.contractNonce) {
      throw new Error("Contract is missing its on-chain nonce.");
    }

    const escrowAddress = contract.contractAddress || scriptAddress;
    const blockfrostProvider = new BlockfrostProvider(
      import.meta.env.VITE_BLOCKFROST_KEY,
    );
    let onChainUtxos = [];
    try {
      onChainUtxos = await blockfrostProvider.fetchAddressUTxOs(escrowAddress);
    } catch {
      onChainUtxos = await blockfrostProvider.fetchUtxos(escrowAddress);
    }
    if (!onChainUtxos?.length) {
      throw new Error(`No funds found at: ${escrowAddress}.`);
    }

    const rawUtxo = findEscrowUtxo(onChainUtxos, {
      milestoneId,
      clientAddress: clientAddr,
      contractNonce: contract.datum.contractNonce,
    });
    if (!rawUtxo) {
      throw new Error(
        `No escrow UTxO for this contract found at ${escrowAddress}.`,
      );
    }

    const chainDatum = rawUtxo.escrowDatum;
    if (!hashMatches(clientAddr, chainDatum.clientHash)) {
      throw new Error("Client address does not match the on-chain datum.");
    }
    if (!hashMatches(freelancerAddr, chainDatum.freelancerHash)) {
      throw new Error("Freelancer address does not match the on-chain datum.");
    }
    const feeAddress = [contract.datum?.feeAddress, clientAddr, address].find(
      (candidate) => hashMatches(candidate, chainDatum.feeAddressHash),
    );
    const arbitratorAddress = [contract.datum?.arbitrator, clientAddr].find(
      (candidate) => hashMatches(candidate, chainDatum.arbitratorHash),
    );
    if (!feeAddress || !arbitratorAddress) {
      throw new Error(
        "Could not map the on-chain fee or arbitrator hash to a known address.",
      );
    }

    const currentDatum = {
      client: clientAddr,
      freelancer: freelancerAddr,
      total_amount: chainDatum.total_amount,
      milestones: chainDatum.milestones,
      contract_nonce: chainDatum.contract_nonce,
      fee_percent: chainDatum.fee_percent,
      fee_address: feeAddress,
      expiration: chainDatum.expiration,
      arbitrator: arbitratorAddress,
    };
    const formattedUtxo = {
      input: {
        txHash: rawUtxo.txHash || rawUtxo.input?.txHash,
        outputIndex: rawUtxo.outputIndex ?? rawUtxo.input?.outputIndex,
      },
      output: {
        address: escrowAddress,
        amount: rawUtxo.amount || rawUtxo.output?.amount,
      },
    };

    return { currentDatum, formattedUtxo, clientAddr, freelancerAddr };
  };

  // Client cancels the contract and reclaims remaining escrow funds.
  const handleRefund = async () => {
    if (!connected || !wallet) {
      showError("Please connect your wallet first");
      return;
    }
    setIsRefundModalOpen(false);
    setIsRefunding(true);
    const pendingKey = `pendingRefund:${id}`;
    try {
      // Recording-only retry: the refund tx already went on-chain earlier.
      const pendingTxHash = localStorage.getItem(pendingKey);
      if (pendingTxHash) {
        await api.refundContract(id, pendingTxHash);
        localStorage.removeItem(pendingKey);
        success(`Refund recorded! TX: ${pendingTxHash.slice(0, 16)}...`);
        refreshContract();
        return;
      }

      const { currentDatum, formattedUtxo, clientAddr } =
        await locateEscrowUtxo();

      const paidLovelace = currentDatum.milestones
        .filter((m) => m.paid)
        .reduce((sum, m) => sum + Number(m.amount), 0);
      const refundLovelace = Number(contract.totalAmount) - paidLovelace;
      if (refundLovelace <= 0) {
        throw new Error("Nothing left in escrow to refund.");
      }

      // Validator rule: with paid milestones, refund only after expiration
      // (and the tx must set invalidBefore - handled by the builder).
      const afterExpiration = paidLovelace > 0;

      const txHash = await buildRefundTransaction(
        wallet,
        contract.contractAddress || scriptAddress,
        currentDatum,
        refundLovelace,
        clientAddr,
        formattedUtxo,
        { afterExpiration },
      );

      localStorage.setItem(pendingKey, txHash);
      await api.refundContract(id, txHash);
      localStorage.removeItem(pendingKey);

      success(
        `Contract refunded - ${lovelaceToAda(refundLovelace)} ADA returned! TX: ${txHash.slice(0, 16)}...`,
      );
      refreshContract();
    } catch (error) {
      console.error("Refund error:", error);
      const resp = error.response?.data;
      let msg = resp?.message || error.message || "Failed to refund contract";
      if (localStorage.getItem(pendingKey)) {
        msg = `The refund was sent on-chain, but recording it failed: ${msg} - click Refund again to retry recording (no new transaction will be made).`;
      }
      showError(msg);
    } finally {
      setIsRefunding(false);
    }
  };

  // Freelancer recovers a milestone that is marked paid on-chain but whose
  // payout never reached them (e.g. the release tx was rejected after datum
  // update, or funds were re-locked without payout).
  const handleWithdraw = async (milestoneId) => {
    if (!connected || !wallet) {
      showError("Please connect your wallet first");
      return;
    }
    setIsWithdrawing({ ...isWithdrawing, [milestoneId]: true });
    const pendingKey = `pendingWithdraw:${id}:${milestoneId}`;
    try {
      const pendingTxHash = localStorage.getItem(pendingKey);
      if (pendingTxHash) {
        await api.withdrawMilestone(id, milestoneId, pendingTxHash);
        localStorage.removeItem(pendingKey);
        success(`Withdrawal recorded! TX: ${pendingTxHash.slice(0, 16)}...`);
        refreshContract();
        return;
      }

      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) throw new Error("Milestone not found");

      const { currentDatum, formattedUtxo, freelancerAddr } =
        await locateEscrowUtxo(milestoneId);

      // Same fee math as the release flow
      const milestoneLovelace = Number(milestone.amount);
      const feePercent = currentDatum.fee_percent;
      const feeLovelace = Math.floor((milestoneLovelace * feePercent) / 10000);
      const withdrawLovelace = milestoneLovelace - feeLovelace;

      // Remainder = what's in the UTXO minus this milestone's full amount
      const utxoLovelace = Number(
        (formattedUtxo.output.amount || []).find(
          (a) => a.unit === "lovelace",
        )?.quantity || 0,
      );
      const remainingLovelace = utxoLovelace - milestoneLovelace;

      const txHash = await buildWithdrawTransaction(
        wallet,
        contract.contractAddress || scriptAddress,
        milestoneId,
        currentDatum,
        withdrawLovelace,
        freelancerAddr,
        remainingLovelace,
        formattedUtxo,
      );

      localStorage.setItem(pendingKey, txHash);
      await api.withdrawMilestone(id, milestoneId, txHash);
      localStorage.removeItem(pendingKey);

      success(
        `Withdrew ${lovelaceToAda(withdrawLovelace)} ADA! TX: ${txHash.slice(0, 16)}...`,
      );
      refreshContract();
    } catch (error) {
      console.error("Withdraw error:", error);
      const resp = error.response?.data;
      let msg = resp?.message || error.message || "Failed to withdraw";
      if (localStorage.getItem(pendingKey)) {
        msg = `The withdrawal was sent on-chain, but recording it failed: ${msg} - click Withdraw again to retry recording (no new transaction will be made).`;
      }
      showError(msg);
    } finally {
      setIsWithdrawing({ ...isWithdrawing, [milestoneId]: false });
    }
  };

  // Refund eligibility (mirrors validator rules so we don't build doomed txs)
  const paidMilestonesExist = (contract?.datum?.milestones || []).some(
    (m) => m.paid,
  );
  const expirationMs = contract?.datum?.expiration
    ? new Date(contract.datum.expiration).getTime()
    : null;
  const isExpired = expirationMs ? Date.now() > expirationMs : false;
  const canRefund =
    isClient &&
    isFunded &&
    contract?.offchainState !== "CANCELLED" &&
    (!paidMilestonesExist || isExpired);

  // Withdraw eligibility per milestone: paid on-chain but no confirmed payout
  const confirmedPayoutMilestoneIds = new Set(
    (contract?.releases || [])
      .filter(
        (r) =>
          r.status === "CONFIRMED" &&
          (r.paymentType === "release" || r.paymentType === "payout"),
      )
      .map((r) => r.milestoneId)
      .filter(Boolean),
  );
  const canWithdrawMilestone = (milestone) => {
    if (!isFreelancer) return false;
    const datumMilestone = (contract?.datum?.milestones || []).find(
      (m) => m.id === milestone.id,
    );
    return (
      !!datumMilestone?.paid && !confirmedPayoutMilestoneIds.has(milestone.id)
    );
  };

  return (
    <div className={styles.contractDetail}>
      <div className={styles.container}>
        <BackButton />
        <Breadcrumbs
          items={[
            { label: "Home", path: "/" },
            {
              label: "Dashboard",
              path: isClient ? "/dashboard/client" : "/dashboard/freelancer",
            },
            { label: `Contract #${id.slice(0, 8)}`, path: `/contracts/${id}` },
          ]}
        />

        <Card>
          <h1>Contract Details</h1>
          {/* Debug: show raw contract when available */}
          {contract && (
            <details style={{ marginBottom: "1rem" }}>
              <summary style={{ cursor: "pointer" }}>
                Show raw contract data
              </summary>
              <pre style={{ maxHeight: 300, overflow: "auto" }}>
                {JSON.stringify(contract, null, 2)}
              </pre>
            </details>
          )}
          <div className={styles.info}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Contract ID:</span>
              <span className={styles.value}>{id}</span>
            </div>
            {scriptAddress && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Contract Address:</span>
                <span className={styles.value}>
                  <code>{scriptAddress}</code>
                </span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.label}>Status:</span>
              <span
                className={`${styles.status} ${
                  styles[contract?.offchainState?.toLowerCase()] || ""
                }`}
              >
                {contract?.offchainState || "Unknown"}
              </span>
            </div>
            {contract?.totalAmount && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Total Amount:</span>
                <span className={styles.value}>
                  <strong>{contract.totalAmount / 1000000} ADA</strong>
                </span>
              </div>
            )}
          </div>

          {/* Deposit Section for Clients */}
          {needsDeposit && (
            <Card className={styles.depositSection}>
              <h2>Fund Escrow</h2>
              {hasPendingDeposit ? (
                <p className={styles.depositInfo}>
                  Your deposit has been submitted and is awaiting on-chain
                  confirmation. This usually takes under a minute; this page
                  will update automatically. If the transaction never
                  confirms, it will be marked failed after 30 minutes and you
                  can deposit again.
                </p>
              ) : (
                <p className={styles.depositInfo}>
                  Deposit{" "}
                  <strong>{lovelaceToAda(contract.totalAmount)} ADA</strong> to
                  the escrow contract to lock funds.
                </p>
              )}
              {!connected && !hasPendingDeposit && (
                <p className={styles.walletWarning}>
                  Please connect your wallet to deposit funds.
                </p>
              )}
              {!hasPendingDeposit && (
                <Button
                  variant="primary"
                  onClick={handleDeposit}
                  disabled={!connected || isDepositing}
                  className={styles.depositButton}
                >
                  {isDepositing
                    ? "Processing..."
                    : `Deposit ${lovelaceToAda(contract.totalAmount)} ADA`}
                </Button>
              )}
              {scriptAddress && (
                <div className={styles.contractInfo}>
                  <p className={styles.smallText}>
                    Contract Address: <code>{scriptAddress}</code>
                    {!contract.contractAddress && contractScript?.address && (
                      <span> (global script address)</span>
                    )}
                  </p>
                </div>
              )}
            </Card>
          )}

          <WalletPicker
            isOpen={isWalletPickerOpen}
            onClose={() => setIsWalletPickerOpen(false)}
            onSelect={onWalletSelected}
          />

          <Modal
            isOpen={isSwitchModalOpen}
            onClose={() => setIsSwitchModalOpen(false)}
            title="Wallet mismatch"
          >
            <p>
              The wallet you selected is not the currently connected wallet. You
              can switch accounts in your wallet extension and click{" "}
              <strong>I switched</strong>, or use the currently connected wallet
              and link it to your account.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button onClick={trySwitchingWallet} disabled={isDepositing}>
                I switched
              </Button>
              <Button
                variant="secondary"
                onClick={signAndLinkCurrent}
                disabled={isLinking}
              >
                {isLinking ? "Linking..." : "Use connected & link"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsSwitchModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            title="Submit Work for Review"
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <p>Describe the work you have completed for this milestone.</p>
              <textarea
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  minHeight: "100px",
                }}
                placeholder="Enter submission notes/links..."
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                }}
              >
                <Button
                  variant="ghost"
                  onClick={() => setIsSubmitModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitWork}>Submit for Approval</Button>
              </div>
            </div>
          </Modal>

          {/* Refund Section for Clients */}
          {canRefund && (
            <Card className={styles.depositSection}>
              <h2>Cancel &amp; Refund</h2>
              <p className={styles.depositInfo}>
                {paidMilestonesExist
                  ? "The contract has expired. You can reclaim the remaining escrow funds (already-paid milestones stay with the freelancer)."
                  : "No milestones have been paid yet. You can cancel this contract and reclaim the full escrow deposit."}
              </p>
              {!connected && (
                <p className={styles.walletWarning}>
                  Please connect your wallet to request a refund.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => setIsRefundModalOpen(true)}
                disabled={!connected || isRefunding}
              >
                {isRefunding ? "Processing..." : "Cancel Contract & Refund"}
              </Button>
            </Card>
          )}

          <Modal
            isOpen={isRefundModalOpen}
            onClose={() => setIsRefundModalOpen(false)}
            title="Cancel contract and refund?"
          >
            <p>
              This permanently cancels the contract on-chain and returns the
              remaining escrow funds to your wallet. The freelancer will be
              notified. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button onClick={handleRefund} disabled={isRefunding}>
                Yes, refund me
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsRefundModalOpen(false)}
              >
                Keep contract
              </Button>
            </div>
          </Modal>

          {/* Deposit Status */}
          {isClient && contract?.deposits && contract.deposits.length > 0 && (
            <Card className={styles.depositsSection}>
              <h2>Deposit History</h2>
              <div className={styles.depositList}>
                {contract.deposits.map((deposit) => (
                  <div key={deposit._id} className={styles.depositItem}>
                    <div className={styles.depositRow}>
                      <span className={styles.label}>Amount:</span>
                      <span className={styles.value}>
                        {deposit.amountADA} ADA
                      </span>
                    </div>
                    <div className={styles.depositRow}>
                      <span className={styles.label}>Status:</span>
                      <span
                        className={`${styles.status} ${
                          styles[deposit.status?.toLowerCase()] || ""
                        }`}
                      >
                        {deposit.status}
                      </span>
                    </div>
                    {deposit.txHash && (
                      <div className={styles.depositRow}>
                        <span className={styles.label}>Transaction:</span>
                        <code className={styles.txHash}>
                          {deposit.txHash.slice(0, 20)}...
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {contract?.milestones && contract.milestones.length > 0 && (
            <div className={styles.milestones}>
              <h2>Milestones</h2>
              <div className={styles.milestoneList}>
                {contract.milestones.map((milestone) => (
                  <Card key={milestone.id} className={styles.milestone}>
                    <div className={styles.milestoneHeader}>
                      <h3>{milestone.title}</h3>
                      <span className={styles.milestoneStatus}>
                        {milestone.status}
                      </span>
                    </div>
                    <p className={styles.milestoneAmount}>
                      Amount: {milestone.amount / 1000000} ADA
                    </p>
                    {milestone.dueDate && (
                      <p className={styles.milestoneDue}>
                        Due: {new Date(milestone.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    {isFreelancer && milestone.status === "pending" && (
                      <Button
                        variant="primary"
                        className={styles.actionButton}
                        onClick={() => openSubmitModal(milestone)}
                      >
                        Submit Work
                      </Button>
                    )}
                    {isClient &&
                      milestone.status === "submitted" &&
                      isFunded && (
                        <Button
                          variant="success"
                          className={styles.actionButton}
                          onClick={() => handleApproveMilestone(milestone.id)}
                          disabled={isApproving[milestone.id]}
                        >
                          {isApproving[milestone.id]
                            ? "Processing..."
                            : "Approve & Release Payment"}
                        </Button>
                      )}
                    {isClient && milestone.status === "approved" && (
                      <p className={styles.milestoneApproved}>
                        ✓ Approved - Payment released to freelancer
                      </p>
                    )}
                    {canWithdrawMilestone(milestone) && (
                      <>
                        <p className={styles.walletWarning}>
                          This milestone is marked paid on-chain, but no
                          payout to you was recorded. You can withdraw the
                          funds directly from escrow.
                        </p>
                        <Button
                          variant="primary"
                          className={styles.actionButton}
                          onClick={() => handleWithdraw(milestone.id)}
                          disabled={!connected || isWithdrawing[milestone.id]}
                        >
                          {isWithdrawing[milestone.id]
                            ? "Processing..."
                            : "Withdraw Payment"}
                        </Button>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className={styles.authPrompt}>
              <p>Please log in to view contract details.</p>
              <Link to="/login">
                <Button>Login</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
