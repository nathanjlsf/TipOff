import React, { useState, useEffect } from "react";

export default function Standings() {
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/standings");
        const data = await response.json();
        setStandings(data);
      } catch (error) {
        console.error("❌ Error fetching standings:", error);
      }
    };

    fetchStandings();
  }, []);

  const east = standings.filter(team => team.Conference === "East");
  const west = standings.filter(team => team.Conference === "West");

  const renderTable = (teams, title) => (
    <div style={conferenceBlock}>
      <h3 style={conferenceTitle}>{title} Conference</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>Win%</th>
            <th>GB</th>
            <th>Last 10</th>
            <th>Streak</th>
          </tr>
        </thead>
        <tbody>
          {teams.sort((a, b) => a.ConferenceRank - b.ConferenceRank).map((team, idx) => (
            <tr key={team.TeamID}>
              <td>{team.PlayoffRank}</td>
              <td>{team.TeamName}</td>
              <td>{team.WINS}</td>
              <td>{team.LOSSES}</td>
              <td>{(team.WinPCT * 100).toFixed(1)}%</td>
              <td>{team.ConferenceGamesBack}</td>
              <td>{team.L10}</td>
              <td>{team.CurrentStreak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>🏆 NBA Team Standings (2024-25)</h2>
      {renderTable(east, "Eastern")}
      {renderTable(west, "Western")}
    </div>
  );
}

const containerStyle = {
  width: "100vw",
  padding: "40px",
  fontFamily: "Arial, sans-serif",
  backgroundColor: "#f9f9f9",
  minHeight: "100vh",
  boxSizing: "border-box",
};

const headerStyle = {
  textAlign: "center",
  marginBottom: "30px",
};

const conferenceBlock = {
  marginBottom: "40px",
};

const conferenceTitle = {
  fontSize: "22px",
  marginBottom: "10px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  backgroundColor: "#fff",
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};

const style = document.createElement("style");
style.innerHTML = `
  table th, table td {
    border: 1px solid #ccc;
    padding: 10px;
    text-align: center;
  }
  table th {
    background-color: #f1f1f1;
  }
`;
document.head.appendChild(style);
