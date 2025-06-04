import React, { useState, useEffect } from "react";

export default function StatLeaders() {
  const [allTimeLeaders, setAllTimeLeaders] = useState({});
  const [playoffLeaders, setPlayoffLeaders] = useState({});
  const [currentSeasonLeaders, setCurrentSeasonLeaders] = useState({});
  const [activeTab, setActiveTab] = useState("allTime");

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const allTime = await fetch("http://127.0.0.1:5000/all-time-leaders").then(res => res.json());
        const playoffs = await fetch("http://127.0.0.1:5000/all-time-playoff-leaders").then(res => res.json());
        const current = await fetch("http://127.0.0.1:5000/current-season-leaders").then(res => res.json());

        setAllTimeLeaders(allTime);
        setPlayoffLeaders(playoffs);
        setCurrentSeasonLeaders(processCurrentLeaders(current));
      } catch (error) {
        console.error("Error fetching leaders:", error);
      }
    };

    fetchLeaders();
  }, []);

  const processCurrentLeaders = (players) => {
    const categories = {
      "Points Per Game": [],
      "Rebounds Per Game": [],
      "Assists Per Game": [],
      "Steals Per Game": [],
      "Blocks Per Game": [],
    };
  
    players.forEach(player => {
      categories["Points Per Game"].push({
        player: player.PLAYER,
        team: player.TEAM,
        stat: (player.PTS / player.GP).toFixed(1)
      });
      categories["Rebounds Per Game"].push({
        player: player.PLAYER,
        team: player.TEAM,
        stat: (player.REB / player.GP).toFixed(1)
      });
      categories["Assists Per Game"].push({
        player: player.PLAYER,
        team: player.TEAM,
        stat: (player.AST / player.GP).toFixed(1)
      });
      categories["Steals Per Game"].push({
        player: player.PLAYER,
        team: player.TEAM,
        stat: (player.STL / player.GP).toFixed(1)
      });
      categories["Blocks Per Game"].push({
        player: player.PLAYER,
        team: player.TEAM,
        stat: (player.BLK / player.GP).toFixed(1)
      });
    });
  
    // Sort each category descending
    for (const cat in categories) {
      categories[cat].sort((a, b) => b.stat - a.stat);
    }
  
    return categories;
  };  

  const renderCategory = (title, players) => (
    <div key={title} style={categoryBlock}>
      <h3 style={categoryTitle}>{title}</h3>
      <ul style={listStyle}>
        {players.map((player, idx) => (
          <li key={idx} style={itemStyle}>
            <strong>{player.player}</strong> ({player.team}) — {player.stat}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>🏀 NBA Stat Leaders</h2>

      {/* Tabs */}
      <div style={tabContainer}>
        <button style={activeTab === "allTime" ? activeTabBtn : tabBtn} onClick={() => setActiveTab("allTime")}>All-Time Leaders</button>
        <button style={activeTab === "playoffs" ? activeTabBtn : tabBtn} onClick={() => setActiveTab("playoffs")}>Playoff Leaders</button>
        <button style={activeTab === "current" ? activeTabBtn : tabBtn} onClick={() => setActiveTab("current")}>Current Season Leaders</button>
      </div>

      {/* Content based on tab */}
      {activeTab === "allTime" &&
        Object.entries(allTimeLeaders).map(([category, players]) => renderCategory(category.replace(/_/g, " "), players))
      }

      {activeTab === "playoffs" &&
        Object.entries(playoffLeaders).map(([category, players]) => renderCategory(category.replace(/_/g, " "), players))
      }

      {activeTab === "current" &&
        Object.entries(currentSeasonLeaders).map(([category, players]) => renderCategory(category, players.slice(0, 10)))
      }
    </div>
  );
}

/* 📌 Styles */
const containerStyle = {
  width: "100vw",
  margin: "0 auto",
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

const tabContainer = {
  display: "flex",
  justifyContent: "center",
  gap: "10px",
  marginBottom: "30px",
};

const tabBtn = {
  padding: "10px 20px",
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

const categoryBlock = {
  marginBottom: "40px",
};

const categoryTitle = {
  fontSize: "20px",
  marginBottom: "10px",
  color: "#333",
};

const listStyle = {
  listStyleType: "none",
  padding: 0,
  maxWidth: "600px",
  margin: "0 auto",
};

const itemStyle = {
  marginBottom: "12px",
  fontSize: "18px",
};
