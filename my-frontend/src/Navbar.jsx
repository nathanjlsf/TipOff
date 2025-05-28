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
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#333",
  padding: "15px 20px",
  color: "white",
  position: "sticky",
  top: "0",
  zIndex: "100",
  width: "100vw",
  boxSizing: "border-box",
};

const logoStyle = {
  marginBottom: "10px",
  fontSize: "24px",
};

const navLinksContainer = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
};

const navLinksStyle = {
  display: "flex",
  gap: "25px",
};

const navLinkStyle = {
  color: "white",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: "bold",
};