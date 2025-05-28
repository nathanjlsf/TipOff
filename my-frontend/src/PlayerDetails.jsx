import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function PlayerDetails() {
  const { playerId } = useParams();
  const [playerStats, setPlayerStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/player-career-stats/${playerId}`);
        const data = await res.json();
        setPlayerStats(data);
      } catch (error) {
        console.error("Failed to fetch player stats:", error);
      }
    };
    fetchStats();
  }, [playerId]);

  if (!playerStats) return <p>Loading player stats...</p>;

  return (
    <div style={{ padding: "30px" }}>
      <h2>{playerStats.name}</h2>
      <h3>Career Stats</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Season</th>
            <th>Team</th>
            <th>GP</th>
            <th>PTS</th>
            <th>AST</th>
            <th>REB</th>
          </tr>
        </thead>
        <tbody>
          {playerStats.career_stats.map((stat, idx) => (
            <tr key={idx}>
              <td>{stat.season}</td>
              <td>{stat.team_abbreviation}</td>
              <td>{stat.games_played}</td>
              <td>{stat.points}</td>
              <td>{stat.assists}</td>
              <td>{stat.rebounds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
