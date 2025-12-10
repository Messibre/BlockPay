export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate entry",
      field: Object.keys(err.keyPattern)[0],
    });
  }

  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }

  res.status(500).json({ message: "Internal server error" });
};

