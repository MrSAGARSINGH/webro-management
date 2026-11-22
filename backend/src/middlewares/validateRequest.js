
export const validateRequest = (schema, source = "body") => {
  return (req, res, next) => {
    const allowedSources = ["body", "query", "params"];

    if (!allowedSources.includes(source)) {
      return next(
        new Error("Invalid validation source")
      );
    }

    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Request validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Express 5 request query is a getter.
    // Store parsed values separately.
    if (source === "query") {
      req.validatedQuery = result.data;
    } else if (source === "params") {
      req.validatedParams = result.data;
    } else {
      req.body = result.data;
    }

    next();
  };
};
