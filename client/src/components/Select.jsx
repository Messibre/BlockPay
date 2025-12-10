import styles from "./Select.module.css";

export default function Select({
  label,
  error,
  options = [],
  className = "",
  ...props
}) {
  const selectId =
    props.id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`${styles.select} ${error ? styles.error : ""}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
}
