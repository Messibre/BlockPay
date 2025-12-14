import { useQuery } from "@tanstack/react-query";
import Card from "../components/Card.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import BackButton from "../components/BackButton.jsx";
import api from "../services/api.js";
import styles from "./ClientDashboard.module.css";

export default function Payments() {
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ["myContracts", "all"],
    queryFn: () => api.getMyContracts(""),
  });

  if (isLoading) return <LoadingSpinner />;

  // Filter for contracts with funding/payments
  const paidContracts = contractsData?.contracts?.filter(c => 
    c.offchainState === "FUNDED" || c.offchainState === "COMPLETED" || c.offchainState === "ACTIVE"
  ) || [];

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        <BackButton label="Back to Dashboard" />
        <div className={styles.header}>
            <h1>Payment History</h1>
        </div>

        <Card>
            {paidContracts.length === 0 ? (
                <div className={styles.empty}>No payment records found.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {paidContracts.map(contract => (
                        <div key={contract._id} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '1rem',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                             <div>
                                 <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{contract.projectId?.title || "Contract"}</h4>
                                 <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                     {new Date(contract.createdAt).toLocaleDateString()}
                                 </p>
                             </div>
                             <div style={{ textAlign: 'right' }}>
                                 <div style={{ 
                                     fontSize: '1.2rem', 
                                     fontWeight: 'bold', 
                                     color: contract.offchainState === 'COMPLETED' ? 'var(--success)' : 'var(--warning)' 
                                 }}>
                                     {contract.totalAmount / 1000000} ADA
                                 </div>
                                 <span style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>{contract.offchainState}</span>
                             </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
      </div>
    </div>
  );
}
