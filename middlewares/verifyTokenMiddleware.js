import { verifyToken } from "../models/utils/verifyToken.js";

export function verifyTokenMiddleware(req, res, next) {
  console.log("Verifying token middleware...");

  const authHeader = req.headers.authorization;
  console.log({ authHeader });

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Token not provided or invalid format" });
  }
  const token = authHeader.split(" ")[1]; // Extrae solo el token
  console.log({ token });
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    console.log({ decoded });
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: "Invalid token" });
  }
}
