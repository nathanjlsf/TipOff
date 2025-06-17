import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function estimateWinProbability(homeScore, awayScore, quarter = 1, timeLeftInQuarter = 0) {
  const totalTime = 48 * 60;
  const timeElapsed = (quarter - 1) * 12 * 60 + (12 * 60 - timeLeftInQuarter);
  const timeFactor = timeElapsed / totalTime;

  const scoreDiff = homeScore - awayScore;
  let baseProbability = 50 + scoreDiff * 1.5;
  const finalProbability = baseProbability + Math.abs(scoreDiff) * timeFactor * 1.5;

  if (isNaN(finalProbability)) return 50; 

  return Math.min(100, Math.max(0, finalProbability));
}

function GameDetails() {
  const { gameId } = useParams();
  const [gameDetails, setGameDetails] = useState(null);
  const [playByPlay, setPlayByPlay] = useState([]);
  const [viewingTeam, setViewingTeam] = useState("home");
  const [activeTab, setActiveTab] = useState("summary"); 
  const [winProbHistory, setWinProbHistory] = useState([]);

  const formatClock = (isoTime) => {
    if (!isoTime || !isoTime.startsWith("PT")) return "00:00";
    const match = isoTime.match(/PT(\d+)M([\d.]+)S/);
    if (!match) return "00:00";
    const minutes = match[1].padStart(2, '0');
    const seconds = Math.floor(parseFloat(match[2])).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const fetchGameDetails = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/game-boxscore/${gameId}`);
      const data = await response.json();
      setGameDetails(data);
    } catch (error) {
      console.error("Error fetching game details:", error);
    }
  };

  const fetchPlayByPlay = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/game-playbyplay/${gameId}`);
      const data = await response.json();
      if (data.play_by_play) {
        setPlayByPlay(data.play_by_play);
      }
    } catch (error) {
      console.error("Error fetching play-by-play data:", error);
    }
  };

  useEffect(() => {
    fetchGameDetails();
    fetchPlayByPlay();

    const interval = setInterval(() => {
      fetchGameDetails();
      fetchPlayByPlay();
    }, 30000);

    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (!gameDetails) return;

    const now = new Date().toLocaleTimeString();
    const prob = estimateWinProbability(
      gameDetails.homeTeam.score,
      gameDetails.awayTeam.score,
      gameDetails.summary?.quarter ?? 4,
      gameDetails.summary?.secondsRemaining ?? 0
    );
    setWinProbHistory([{ time: now, homeProb: prob, awayProb: 100 - prob }]);
  }, [gameDetails]);

  useEffect(() => {
    if (!playByPlay.length || !gameDetails) return;

    const flowData = playByPlay
      .filter(a => a.scoreHome != null && a.scoreAway != null && a.clock)
      .map(a => {
        // 1) split the “MM:SS” clock
        const [minStr = "00", secStr = "00"] = a.clock.split(":");
        const min = parseInt(minStr, 10) || 0;
        const sec = parseInt(secStr, 10) || 0;

        // 2) compute elapsed seconds since tip-off
        const elapsed =
          (a.period - 1) * 12 * 60 +     // full quarters
          (12 * 60 - (min * 60 + sec));  // time into current quarter

        // 3) grab scores & estimate
        const home = a.scoreHome;
        const away = a.scoreAway;
        const prob = estimateWinProbability(home, away, a.period, min * 60 + sec);
        const homeProb = Math.round(prob * 10) / 10;
        const awayProb = Math.round((100 - prob) * 10) / 10;

        return {
          x: elapsed,                                       // numeric axis
          label: `Q${a.period} ${min}:${sec.toString().padStart(2,"0")}`,  
          home, away, homeProb, awayProb
        };
      });

    setWinProbHistory(flowData);
  }, [playByPlay, gameDetails]);

  if (!gameDetails) return <p>Loading game details...</p>;

  const maxScore = Math.max(
    gameDetails.homeTeam.score,
    gameDetails.awayTeam.score
  );

  const activeTeam = viewingTeam === "home" ? gameDetails.homeTeam : gameDetails.awayTeam;

  const renderPlayerStats = (players) => (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th>Name</th>
          <th>PTS</th>
          <th>AST</th>
          <th>REB</th>
          <th>FGM/A</th>
          <th>3PM/A</th>
          <th>FTM/A</th>
          <th>STL</th>
          <th>BLK</th>
          <th>TO</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player, idx) => (
          <tr key={idx}>
            <td>{player.name}</td>
            <td>{player.points}</td>
            <td>{player.assists}</td>
            <td>{player.rebounds}</td>
            <td>{player.fieldGoalsMade}/{player.fieldGoalsAttempted}</td>
            <td>{player.threePointersMade}/{player.threePointersAttempted}</td>
            <td>{player.freeThrowsMade}/{player.freeThrowsAttempted}</td>
            <td>{player.steals}</td>
            <td>{player.blocks}</td>
            <td>{player.turnovers}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>Game Details</h2>
      <h3>{gameDetails.homeTeam.teamName} vs {gameDetails.awayTeam.teamName}</h3>
      <p style={scoreStyle}>
        Final Score: <strong>{gameDetails.homeTeam.score}</strong> - <strong>{gameDetails.awayTeam.score}</strong>
      </p>

      {/* Tabs */}
      <div style={tabStyle}>
        <button onClick={() => setActiveTab("summary")} style={activeTab === "summary" ? activeTabBtn : tabBtn}>Summary</button>
        <button onClick={() => setActiveTab("boxscore")} style={activeTab === "boxscore" ? activeTabBtn : tabBtn}>Box Score</button>
        <button onClick={() => setActiveTab("playbyplay")} style={activeTab === "playbyplay" ? activeTabBtn : tabBtn}>Play-by-Play</button>
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
  <>
    <h3 style={sectionTitle}>📊 Scores by Quarter</h3>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th>Team</th>
          {["Q1", "Q2", "Q3", "Q4", "OT"].map((q) => (
            <th key={q}>{q}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[gameDetails.homeTeam, gameDetails.awayTeam].map((team, idx) => (
          <tr key={idx}>
            <td><strong>{team.teamName}</strong></td>
            {["Q1", "Q2", "Q3", "Q4", "OT"].map((q) => (
              <td key={q}>
                {(team.summary?.quarters?.[q]) ?? "-"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>

    <h3 style={sectionTitle}>📈 Team Stats</h3>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th>Stat</th>
          <th>{gameDetails.homeTeam.teamName}</th>
          <th>{gameDetails.awayTeam.teamName}</th>
        </tr>
      </thead>
      <tbody>
        {[
          { label: "Points", key: "points" },
          { label: "FGM/A", key: "fieldGoals" },
          { label: "3PM/A", key: "threePointers" },
          { label: "FTM/A", key: "freeThrows" },
          { label: "Rebounds", key: "rebounds" },
          { label: "Assists", key: "assists" },
          { label: "Steals", key: "steals" },
          { label: "Blocks", key: "blocks" },
          { label: "Turnovers", key: "turnovers" },
        ].map((stat, idx) => (
          <tr key={idx}>
            <td>{stat.label}</td>
            <td>
              {stat.key === "fieldGoals"
                ? `${gameDetails.homeTeam.summary.fieldGoalsMade}/${gameDetails.homeTeam.summary.fieldGoalsAttempted}`
                : stat.key === "threePointers"
                ? `${gameDetails.homeTeam.summary.threePointersMade}/${gameDetails.homeTeam.summary.threePointersAttempted}`
                : stat.key === "freeThrows"
                ? `${gameDetails.homeTeam.summary.freeThrowsMade}/${gameDetails.homeTeam.summary.freeThrowsAttempted}`
                : gameDetails.homeTeam.summary[stat.key] ?? "-"}
            </td>
            <td>
              {stat.key === "fieldGoals"
                ? `${gameDetails.awayTeam.summary.fieldGoalsMade}/${gameDetails.awayTeam.summary.fieldGoalsAttempted}`
                : stat.key === "threePointers"
                ? `${gameDetails.awayTeam.summary.threePointersMade}/${gameDetails.awayTeam.summary.threePointersAttempted}`
                : stat.key === "freeThrows"
                ? `${gameDetails.awayTeam.summary.freeThrowsMade}/${gameDetails.awayTeam.summary.freeThrowsAttempted}`
                : gameDetails.awayTeam.summary[stat.key] ?? "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h3>Predicted Win Probability Over Time</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={winProbHistory}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="category"
          dataKey="period"
          ticks={[1,2,3,4]}
          tickFormatter={p => {
            switch (p) {
              case 1: return "1st";
              case 2: return "2nd";
              case 3: return "3rd";
              case 4: return "4th";
              default: return "";
            }
          }}
        />
        <YAxis domain={[0,100]} />
        <Tooltip />
        <Legend />
        <Line dataKey="homeProb" stroke="#007bff" name="Home Win %" />
        <Line dataKey="awayProb" stroke="#d32f2f" name="Away Win %" />
      </LineChart>
    </ResponsiveContainer>

    <h3 style={sectionTitle}>Game Flow</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={winProbHistory}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" interval={Math.ceil(winProbHistory.length / 10)} />
        <YAxis domain={[0, maxScore + 5]}/>
        <Tooltip />
        <Legend />
        <Line dataKey="home" stroke="#003DA5" name="Home Score" />
        <Line dataKey="away" stroke="#C9082A" name="Away Score" />
      </LineChart>
    </ResponsiveContainer>
  </>
)}


      {/* Box Score Tab */}
      {activeTab === "boxscore" && (
        <>
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setViewingTeam(viewingTeam === "home" ? "away" : "home")}
              style={toggleBtn}
            >
              View {viewingTeam === "home" ? gameDetails.awayTeam.teamName : gameDetails.homeTeam.teamName} Box Score
            </button>
          </div>
          <h3 style={sectionTitle}>
            {viewingTeam === "home" ? "🏠 Home" : "🛫 Away"} — {activeTeam.teamName}
          </h3>
          {renderPlayerStats(activeTeam.players)}
        </>
      )}

      {/* Play-by-Play Tab */}
      {activeTab === "playbyplay" && (
        <>
          <h3 style={sectionTitle}>📋 Play-by-Play</h3>
          <ul style={playByPlayList}>
            {[...playByPlay].reverse().map((action, idx) => (
              <li key={idx}>
                <strong>Q{action.period}</strong> [{formatClock(action.clock)}] — {action.description}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* Styles */
const containerStyle = {
  width: "100vw",
  margin: "0 auto",
  padding: "40px",
  fontFamily: "Arial, sans-serif",
  backgroundColor: "#f9f9f9",
  minHeight: "100vh",
  boxSizing: "border-box",
};

const headerStyle = { fontSize: "28px", marginBottom: "10px" };
const sectionTitle = { marginTop: "20px", fontSize: "22px" };
const scoreStyle = { fontSize: "18px", margin: "10px 0 30px" };

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "10px",
  marginBottom: "40px",
  backgroundColor: "#fff",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
};

const toggleBtn = {
  padding: "10px 15px",
  fontSize: "16px",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};

const tabStyle = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px",
};

const tabBtn = {
  padding: "10px 15px",
  fontSize: "16px",
  backgroundColor: "#e0e0e0",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};

const activeTabBtn = {
  ...tabBtn,
  backgroundColor: "#007bff",
  color: "white",
};

const playByPlayList = {
  listStyleType: "none",
  padding: 0,
  textAlign: "left",
  maxWidth: "800px",
  margin: "0 auto",
};

const style = document.createElement("style");
style.innerHTML = `
  table th, table td {
    border: 1px solid #ccc;
    padding: 12px;
    text-align: center;
  }
  table th {
    background-color: #f1f1f1;
  }
`;
document.head.appendChild(style);

export default GameDetails;