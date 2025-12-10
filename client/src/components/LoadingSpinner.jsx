import styles from "./LoadingSpinner.module.css";

export default function LoadingSpinner({
  size = "medium",
  fullScreen = false,
}) {
  const sizeClass = styles[size] || styles.medium;

  if (fullScreen) {
    return (
      <div className={styles.fullScreen}>
        <div className={`${styles.spinner} ${sizeClass}`}></div>
      </div>
    );
  }

  return <div className={`${styles.spinner} ${sizeClass}`}></div>;
}
