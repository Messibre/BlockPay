import styles from './UpcomingFeatures.module.css';

export default function UpcomingFeatures() {
    const features = [
        {
            id: 1,
            title: "NFT Receipts",
            description: "Verifiable proof of work on the blockchain. Once a milestone or job is completed, both freelancer and client will mint unique NFT receipts. These NFTs serve as immutable evidence of successful collaboration, building a trustless reputation system and portfolio for future opportunities.",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M8 11h8" />
                    <path d="M12 15V7" />
                </svg>
            ),
            tag: "Reputation"
        },
        {
            id: 2,
            title: "Contract Extensions",
            description: "Seamless integration for any platform. We are building a standalone extension format focused purely on contracts and payments. Platforms like Upwork can integrate this to allow clients to generate approval links for freelancers, bypassing platform constraints while securing payments via smart contracts.",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
            ),
            tag: "Integration"
        }
    ];

    return (
        <section className={styles.upcomingSection}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Coming Soon</h2>
                    <p className={styles.subtitle}>
                        We're constantly evolving. Here's a glimpse of the powerful features arriving in the next update.
                    </p>
                </div>

                <div className={styles.grid}>
                    {features.map((feature) => (
                        <div key={feature.id} className={`${styles.card} glass-panel`}>
                            <div className={styles.iconWrapper}>
                                {feature.icon}
                            </div>
                            <h3 className={styles.cardTitle}>{feature.title}</h3>
                            <p className={styles.cardDescription}>{feature.description}</p>
                            <div>
                                <span className={styles.tag}>{feature.tag}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
