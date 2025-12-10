import { useEffect } from "react";
import styles from "./Toast.module.css";

export default function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <div className={styles.content}>
        <span className={styles.icon}>{getIcon(type)}</span>
        <span className={styles.message}>{message}</span>
      </div>
      <button onClick={onClose} className={styles.close}>
        ×
      </button>
    </div>
  );
}

function getIcon(type) {
  switch (type) {
    case "success":
      return "✓";
    case "error":
      return "✕";
    case "warning":
      return "⚠";
    default:
      return "ℹ";
  }
}
