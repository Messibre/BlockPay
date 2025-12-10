import styles from "./Card.module.css";

export default function Card({ children, className = "", onClick, ...props }) {
  const classes = `${styles.card} ${
    onClick ? styles.clickable : ""
  } ${className}`.trim();

  return (
    <div className={classes} onClick={onClick} {...props}>
      {children}
    </div>
  );
}
