import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@meshsdk/react";
import { resolvePlutusScriptAddress } from "@meshsdk/core";
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
  lovelaceToAda,
  findMatchingUtxo,
} from "../utils/transactions.js";
import { contractScript } from "../constants/script";
import styles from "./ContractDetail.module.css";

export default function ContractDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { wallet, connected, address } = useWallet();
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
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

  // Use contract-specific address if it looks valid, otherwise fall back to global configured script address
  const isValidAddress = (a) => typeof a === "string" && a.length > 30;

  // Try to find address in this order:
  // 1. Contract object itself (if saved)
  // 2. Constants/Env variable
  // 3. Derived from CBOR (Fallback)
  let scriptAddress = null;

  if (isValidAddress(contract?.contractAddress)) {
    scriptAddress = contract.contractAddress;
  } else if (
    contractScript?.address ||
    import.meta?.env?.VITE_ESCROW_SCRIPT_ADDRESS
  ) {
    scriptAddress =
      contractScript.address || import.meta.env.VITE_ESCROW_SCRIPT_ADDRESS;
  } else if (contractScript?.cbor) {
    try {
      // Fallback: Derived from CBOR (Testnet = 0)
      scriptAddress = resolvePlutusScriptAddress(contractScript.cbor, 0);
      console.log("Derived script address from CBOR:", scriptAddress);
    } catch (e) {
      console.error("Failed to derive script address:", e);
    }
  }

  // Debug logs to help diagnose empty page issues
  console.debug("ContractDetail render", {
    id,
    isAuthenticated,
    user,
    contract: contract || null,
    scriptAddress,
  });

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
          "Invalid client address on contract. Connect wallet or fix contract data."
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
          "Invalid freelancer address on contract. Please check freelancer settings."
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
        contract_nonce: contract.datum?.contractNonce || Date.now(),
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
        datum
      );

      // Record deposit with backend (include signer info if present)
      await api.recordDeposit(
        id,
        txHash,
        contract.totalAmount,
        signerAddr,
        signerSignature
      );

      success(`Deposit transaction submitted! TX: ${txHash.slice(0, 16)}...`);
      queryClient.invalidateQueries(["contract", id]);
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
      'Please switch the active account in your wallet extension, then click "I switched"'
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
      const newUser = res.user;
      localStorage.setItem("token", newToken);
      // Force a page refresh of auth context by reloading (or call a login method if available)
      window.location.reload();

      // Proceed with deposit using connected wallet
      setIsSwitchModalOpen(false);
      await proceedWithDeposit(address, signature);
    } catch (e) {
      console.error("Sign & link failed", e);
      showError(
        e.response?.data?.message || e.message || "Failed to sign & link wallet"
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
    try {
      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        throw new Error("Milestone not found");
      }

      const scriptAddress = contract.contractAddress;
      const response = await api.getScriptUtxos(scriptAddress);
      const utxos = response.utxos || [];

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTxOs found in contract script");
      }
      // Basic address validator
      const isBech32 = (s) =>
        typeof s === "string" &&
        /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
        s.length >= 8;

      // 2. Resolve Addresses
      const clientAddr = isBech32(contract.datum?.client)
        ? contract.datum.client
        : isBech32(address)
        ? address
        : null;

      if (!clientAddr) throw new Error("Invalid client address on contract");

      const freelancerAddr = isBech32(contract.datum?.freelancer)
        ? contract.datum.freelancer
        : isBech32(contract.freelancerId?.walletAddress)
        ? contract.freelancerId.walletAddress
        : null;

      if (!freelancerAddr)
        throw new Error("Invalid freelancer address on contract");

      const feeAddr = isBech32(contract.datum?.feeAddress)
        ? contract.datum.feeAddress
        : null;
      const arbitratorAddr = isBech32(contract.datum?.arbitrator)
        ? contract.datum.arbitrator
        : null;

      // 3. Construct Current Datum
      const currentDatum = {
        client: clientAddr,
        freelancer: freelancerAddr,
        total_amount: contract.totalAmount,
        milestones:
          contract.datum?.milestones ||
          (contract.milestones || []).map((m) => ({
            id: m.id,
            amount: m.amount,
            paid: m.status === "approved" || m.status === "paid",
          })),
        contract_nonce: contract.datum?.contractNonce || Date.now(),
        fee_percent: contract.datum?.feePercent || 100,
        fee_address: feeAddr || clientAddr, // Fallback to client if fee addr missing
        expiration: contract.datum?.expiration || null,
        arbitrator: arbitratorAddr || clientAddr, // Fallback
      };

      // Validate critical addresses
      if (!isBech32(currentDatum.client)) {
        throw new Error(`Invalid client address: ${currentDatum.client}`);
      }
      if (!isBech32(currentDatum.freelancer)) {
        throw new Error(`Invalid freelancer address: ${currentDatum.freelancer}`);
      }

      // 4. Find relevant UTxO
      const utxo = findMatchingUtxo(utxos, currentDatum);
      if (!utxo) {
        throw new Error("Contract UTxO not found. Has it been deposited?");
      }

      const milestoneAmount = milestone.amount;
      const feePercent = contract.datum?.feePercent || 100;
      const feeAmount = Math.floor((milestoneAmount * feePercent) / 10000);
      const payoutAmount = milestoneAmount - feeAmount;
      const remainingAmount = currentDatum.total_amount - milestoneAmount;

      // 5. Construct New Datum
      const newDatum = {
        ...currentDatum,
        milestones: currentDatum.milestones.map((m) =>
          m.id === milestoneId ? { ...m, paid: true } : m
        ),
      };

      // 6. Build Transaction
      const feeAddress =
        currentDatum.fee_address ||
        import.meta?.env?.VITE_PLATFORM_FEE_ADDRESS ||
        null;

      const txHash = await buildReleaseTransaction(
        wallet,
        scriptAddress,
        milestoneId,
        currentDatum,
        newDatum,
        payoutAmount,
        contract.freelancerId.walletAddress,
        remainingAmount,
        utxo,
        feeAddress,
        feeAmount
      );

      // 7. Record release with backend
      await api.approveMilestone(id, milestoneId, txHash);

      success(`Milestone approved & released! TX: ${txHash.slice(0, 16)}...`);
      queryClient.invalidateQueries(["contract", id]);
    } catch (error) {
      console.error("Approve error:", error);
      showError(error.message || "Failed to approve milestone");
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
      queryClient.invalidateQueries(["contract", id]);
      setIsSubmitModalOpen(false);
    } catch (error) {
      console.error("Submit work error:", error);
      showError(error.response?.data?.message || "Failed to submit work");
    }
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
              <p className={styles.depositInfo}>
                Deposit{" "}
                <strong>{lovelaceToAda(contract.totalAmount)} ADA</strong> to
                the escrow contract to lock funds.
              </p>
              {!connected && (
                <p className={styles.walletWarning}>
                  Please connect your wallet to deposit funds.
                </p>
              )}
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
