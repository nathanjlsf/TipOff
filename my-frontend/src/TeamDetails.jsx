import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function TeamDetails() {
  const { teamCode } = useParams();
  const [teamInfo, setTeamInfo] = useState(null);
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const infoRes = await fetch(`http://127.0.0.1:5000/team-info/${teamCode}`);
        const info = await infoRes.json();
        setTeamInfo(info);

        const rosterRes = await fetch(`http://127.0.0.1:5000/team-roster/${teamCode}`);
        const rosterData = await rosterRes.json();
        setRoster(rosterData.roster || []);

        const gamesRes = await fetch(`http://127.0.0.1:5000/team-games/${teamCode}`);
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);
      } catch (error) {
        console.error("Error fetching team data:", error);
      }
    };

    if (teamCode) fetchAllData();
  }, [teamCode]);

  if (!teamInfo) return <p style={loadingStyle}>Loading team info...</p>;

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>{teamInfo.full_name}</h2>
      <p style={subHeader}>Conference: {teamInfo.conference} | Division: {teamInfo.division}</p>
      <p style={recordStyle}>Record: {teamInfo.wins}-{teamInfo.losses}</p>

      <h3 style={sectionTitle}>Roster</h3>
      <ul style={listStyle}>
        {roster.map((player, idx) => (
            <li key={idx} style={itemStyle}>
                <Link to={`/player/${player.id}`} style={{ textDecoration: "none", color: "#007bff" }}>
                {player.name} {player.number} {player.position && `— ${player.position}`}
                </Link>
            </li>
        ))}
      </ul>

      <h3 style={sectionTitle}>Recent Games</h3>
      <ul style={listStyle}>
        {games.map((game, idx) => (
          <li key={idx} style={itemStyle}>
            <Link to={`/game/${game.gameId}`} style={{ textDecoration: "none", color: "#007bff" }}>
            {game.date}  {game.opponent} — {game.result}
            </Link>
          </li>
        ))}
      </ul>
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
  fontSize: "28px",
  marginBottom: "10px",
};

const subHeader = {
  textAlign: "center",
  fontSize: "16px",
  color: "#555",
  marginBottom: "10px",
};

const recordStyle = {
  textAlign: "center",
  fontSize: "18px",
  marginBottom: "30px",
};

const sectionTitle = {
  fontSize: "22px",
  marginBottom: "10px",
};

const listStyle = {
  listStyleType: "none",
  padding: 0,
  maxWidth: "600px",
  margin: "0 auto 30px",
};

const itemStyle = {
  fontSize: "18px",
  padding: "8px 0",
  borderBottom: "1px solid #ccc",
};

const loadingStyle = {
  textAlign: "center",
  padding: "40px",
};
