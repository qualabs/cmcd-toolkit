import {PORT} from "./utils/config.js";
import express from "express";
import cmcdRoutes from "./cmcd.routes.js";
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(cors());

app.use("/cmcd/", cmcdRoutes);

app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

app.listen(PORT);
