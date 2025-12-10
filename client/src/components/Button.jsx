import styles from "./Button.module.css";

export default function Button({
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  type = "button",
  onClick,
  className = "",
  ...props
}) {
  const classes =
    `${styles.button} ${styles[variant]} ${styles[size]} ${className}`.trim();

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
