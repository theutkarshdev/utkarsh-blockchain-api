import express from "express";
import cors from "cors";
import walletRoutes from "./routes/walletRoutes.js";

const app = express();
const PORT = 5000;
app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);

// All app routes mounted here
app.use(walletRoutes);

app.listen(PORT, () => {
  console.log(`my application is running on ${PORT}`);
});
