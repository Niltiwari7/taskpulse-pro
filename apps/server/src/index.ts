import app from "./app";

const port = process.env.PORT || 3000;
app.listen(port, (error) => {
  // Express 5 reports bind failures (e.g. EADDRINUSE) here instead of throwing
  if (error) {
    console.error(`Failed to start server on port ${port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Server is running on http://localhost:${port}`);
});