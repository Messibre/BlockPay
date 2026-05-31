import styles from './EmptyState.module.css';
import Button from './Button.jsx';

export default function EmptyState({
  icon,
  title = "Nothing here yet",
  description = "There's no content to display at the moment.",
  action,
  actionText,
  onAction
}) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {(action || onAction) && (
        action || (
          <Button onClick={onAction} variant="primary">
            {actionText || "Get Started"}
          </Button>
        )
      )}
    </div>
  );
}
