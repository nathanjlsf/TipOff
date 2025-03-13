import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={navbarStyle}>
      <h2 style={logoStyle}>🏀 TipOff</h2>
      <div style={navLinksStyle}>
        <Link to="/" style={navLinkStyle}>Home</Link>
        <Link to="/teams" style={navLinkStyle}>Teams</Link>
        <Link to="/standings" style={navLinkStyle}>Team Standings</Link>
        <Link to="/stat-leaders" style={navLinkStyle}>Stat Leaders</Link>
      </div>
    </nav>
  );
}

/* 📌 Styles */
const navbarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#333",
  padding: "15px 20px",
  color: "white",
  position: "sticky",
  top: "0",
  width: "100%",
  zIndex: "1000",
};

const logoStyle = {
  cursor: "pointer",
  margin: "0",
  fontSize: "24px",
};

const navLinksStyle = {
  display: "flex",
  gap: "15px",
};

const navLinkStyle = {
  textDecoration: "none",
  color: "white",
  fontSize: "18px",
  fontWeight: "bold",
};
