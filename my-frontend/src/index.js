import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import App from "./App"; // Import your main App component
import GameDetails from "./gameDetails"; // Import your GameDetails component

// Set up the routing structure
ReactDOM.render(
  <Router>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/game-details/:gameId" element={<GameDetails />} />
    </Routes>
  </Router>,
  document.getElementById("root")
);
