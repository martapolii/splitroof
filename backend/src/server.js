require("dotenv").config({ quiet: true });
const app = require("./app");

const PORT = process.env.PORT || 3000;

// Render needs the server on 0.0.0.0 and gives it a PORT
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SplitRoof API running on port ${PORT}`);
});
