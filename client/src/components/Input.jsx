import styles from "./Input.module.css";

export default function Input({
  label,
  error,
  className = "",
  rows,
  ...props
}) {
  const inputId =
    props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const isTextarea = props.type === "textarea" || rows;

  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      {isTextarea ? (
        <textarea
          id={inputId}
          className={`${styles.input} ${styles.textarea} ${
            error ? styles.error : ""
          }`}
          rows={rows || 4}
          {...props}
        />
      ) : (
        <input
          id={inputId}
          className={`${styles.input} ${error ? styles.error : ""}`}
          {...props}
        />
      )}
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
}
