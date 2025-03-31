import { config } from "dotenv";
import express from "express";
import cmcdRoutes from "./cmcd.routes.js";
import cors from 'cors'
config()

const app = express();

app.use(express.json());
app.use(cors());

app.use("/cmcd/", cmcdRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT);
