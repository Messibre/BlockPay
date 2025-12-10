import { useState } from "react";
import styles from "./SearchBar.module.css";

export default function SearchBar({
  placeholder = "Search...",
  onSearch,
  value: controlledValue,
  onChange: controlledOnChange,
  className = "",
}) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (e) => {
    const newValue = e.target.value;
    if (isControlled) {
      controlledOnChange?.(e);
    } else {
      setInternalValue(newValue);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`${styles.searchBar} ${className}`}
    >
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={styles.input}
      />
      <button type="submit" className={styles.button}>
        🔍
      </button>
    </form>
  );
}
