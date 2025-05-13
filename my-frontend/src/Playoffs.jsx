import React, { useEffect, useState } from "react";

export default function Playoffs() {
  const [bracket, setBracket] = useState(null);

  useEffect(() => {
    const fetchBracket = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/playoff-bracket");
        const data = await response.json();
        setBracket(data);
      } catch (error) {
        console.error("❌ Error fetching playoff bracket:", error);
      }
    };

    fetchBracket();
  }, []);

  if (!bracket) return <p style={loadingStyle}>Loading playoff bracket...</p>;

  const renderRound = (round, title) => (
    <div style={roundStyle}>
      <h4 style={roundTitle}>{title}</h4>
      {round.map((series, idx) => (
        <div key={idx} style={seriesStyle}>
          <p>
            {series.topSeed} ({series.winsTop}) vs {series.bottomSeed} ({series.winsBottom})
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>🏆 NBA Playoffs Bracket</h2>
      <div style={bracketStyle}>
        <div style={conferenceStyle}>
          <h3>East</h3>
          {renderRound(bracket.east.firstRound, "First Round")}
          {renderRound(bracket.east.conferenceSemifinals, "Semifinals")}
          {renderRound(bracket.east.conferenceFinals, "Conference Finals")}
        </div>
        <div style={conferenceStyle}>
          <h3>West</h3>
          {renderRound(bracket.west.firstRound, "First Round")}
          {renderRound(bracket.west.conferenceSemifinals, "Semifinals")}
          {renderRound(bracket.west.conferenceFinals, "Conference Finals")}
        </div>
      </div>
    </div>
  );
}

/* Styles */
const containerStyle = {
  padding: "40px",
  backgroundColor: "#f9f9f9",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

const headerStyle = {
  textAlign: "center",
  marginBottom: "30px",
};

const bracketStyle = {
  display: "flex",
  justifyContent: "space-around",
  flexWrap: "wrap",
};

const conferenceStyle = {
  width: "45%",
  minWidth: "300px",
};

const roundStyle = {
  marginBottom: "20px",
  padding: "10px",
  backgroundColor: "#fff",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
};

const roundTitle = {
  marginBottom: "8px",
  fontSize: "16px",
  fontWeight: "bold",
};

const seriesStyle = {
  padding: "8px 0",
  borderBottom: "1px solid #ddd",
};

const loadingStyle = {
  textAlign: "center",
  padding: "40px",
};
