import express from "express";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});
