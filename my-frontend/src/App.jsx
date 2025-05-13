import React, { useState, useEffect } from "react";
import { format, subDays, addDays } from "date-fns";
import { BrowserRouter as Router, Route, Routes, useNavigate } from "react-router-dom";
import GameDetails from "./gameDetails"; // Import GameDetails page
import Teams from "./Teams";
import Standings from "./Standings";
import StatLeaders from "./StatLeaders";
import Navbar from "./Navbar";
import Playoffs from "./Playoffs";


// Function to get the team logo URL based on the team tricode
const getTeamLogo = (teamId) => 
  `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`;

function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const fetchGames = async () => {
    setLoading(true);
    const formattedDate = format(selectedDate, "yyyy-MM-dd");

    try {
      const liveResponse = await fetch("http://127.0.0.1:5000/live-games");
      const pastResponse = await fetch("http://127.0.0.1:5000/past-games");

      const liveData = await liveResponse.json();
      const pastData = await pastResponse.json();

      console.log("🔵 Live Games Data:", liveData);
      console.log("🟢 Past Games Data:", pastData);

      const pastGamesFiltered = pastData.past_games.filter(game =>
        game.gameTimePST.startsWith(formattedDate)
      );

      let allGames = [];
      if (formattedDate === format(new Date(), "yyyy-MM-dd")) {
        allGames = [...liveData.live_games, ...pastGamesFiltered];
      } else if (selectedDate < new Date()) {
        allGames = pastGamesFiltered;
      }

      console.log("📅 All Games for Selected Date:", allGames);
      setGames(allGames);

      sessionStorage.setItem("games", JSON.stringify(allGames));

    } catch (error) {
      console.error("❌ Error fetching games:", error);
    }
    setLoading(false);
  };

  // Fetch games based on the selected date
  useEffect(() => {
    const savedGames = sessionStorage.getItem("games");
    if (savedGames) {
      setGames(JSON.parse(savedGames));
    } else {
      fetchGames(); // ✅ No param
    }
  
    const interval = setInterval(() => {
      fetchGames(); // ✅ No param
    }, 35000);
  
    return () => clearInterval(interval);
  }, [selectedDate]);  

  // Change date handlers
  const prevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const nextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const resetToToday = () => setSelectedDate(new Date());

  // Navigate to game details page
  const handleGameClick = (game) => {
    navigate(`/game/${game.gameId}`, { state: { game } });
  };

  // Filter games based on search query
  const filteredGames = games.filter(
    (game) =>
      game.homeTeam.teamTricode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.awayTeam.teamTricode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={appContainer}>
      <h2 onClick={resetToToday} style={logoStyle}>🏀 TipOff</h2>

      <div style={dateNavStyle}>
        <button onClick={prevDay} style={buttonStyle}>◀ Previous</button>
        <span style={dateTextStyle}>{format(selectedDate, "EEEE, MMM d, yyyy")}</span>
        <button onClick={nextDay} style={buttonStyle}>Next ▶</button>
      </div>

      {/* Game List */}
      <div style={gameListContainer}>
        {filteredGames.map((game) => (
          <button 
            key={game.gameId} 
            style={gameCardStyle}
            onClick={() => handleGameClick(game)}
          >
            <div style={scoreContainer}>
              {/* Home Team */}
              <div style={teamContainer}>
                <span style={teamNameStyle}>{game.homeTeam.teamTricode}</span>
                <img src={getTeamLogo(game.homeTeam.teamId)} alt={game.homeTeam.teamTricode} style={teamLogo} />
                <span style={recordStyle}>{game.homeTeam.wins} - {game.homeTeam.losses}</span>
              </div>

              {/* Score */}
              <span style={scoreStyle}>{game.homeTeam.score} - {game.awayTeam.score}</span>

              {/* Away Team */}
              <div style={teamContainer}>
                <span style={teamNameStyle}>{game.awayTeam.teamTricode}</span>
                <img src={getTeamLogo(game.awayTeam.teamId)} alt={game.awayTeam.teamTricode} style={teamLogo} />
                <span style={recordStyle}>{game.awayTeam.wins} - {game.awayTeam.losses}</span>
              </div>
            </div>

            {/* Quarter & Game Clock */}
            {game.status.includes("Qtr") && !game.status.includes("End") ? (
              <div style={gameStatusStyle}>
                <span>⏳ {game.status} - {game.gameClock}</span>
              </div>
            ) : (
              <div style={gameStatusStyle}>
                <span>{game.status}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 📌 Styles */

const recordStyle = { fontSize: "14px", color: "gray", marginTop: "3px" };

const teamNameStyle = { fontSize: "16px", fontWeight: "bold", marginTop: "3px" };

const appContainer = {
  width: "100vw",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
  textAlign: "center",
  backgroundColor: "#f4f4f4",
};

const navbarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#333",
  padding: "15px 20px",
  color: "white",
  position: "sticky",
  top: "0",
  zIndex: "100",
  width: "100%",
  boxSizing: "border-box",
};

const logoStyle = {
  cursor: "pointer",
  margin: "0",
};

const navLinksStyle = {
  display: "flex",
  gap: "15px",
};

const tabStyle = {
  padding: "10px",
  backgroundColor: "transparent",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
};

const activeTabStyle = {
  ...tabStyle,
  borderBottom: "2px solid white",
  fontWeight: "bold",
};

const searchInputStyle = {
  padding: "10px",
  fontSize: "16px",
  borderRadius: "5px",
  border: "1px solid #ddd",
  width: "250px",
  textAlign: "center",
};

const dateNavStyle = {
  padding: "20px",
  display: "flex",
  justifyContent: "center",
  gap: "10px",
};

const dateTextStyle = {
  margin: "0 15px",
  fontSize: "18px",
  fontWeight: "bold",
};

const buttonStyle = {
  padding: "10px 15px",
  fontSize: "16px",
  border: "none",
  backgroundColor: "#007BFF",
  color: "white",
  borderRadius: "5px",
  cursor: "pointer",
};

const contentContainer = {
  padding: "20px",
};

const gameListContainer = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
  gap: "30px",
  maxWidth: "1300px",
  margin: "0 auto",
};

const gameCardStyle = {
  padding: "25px",
  backgroundColor: "white",
  textAlign: "center",
  borderRadius: "15px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  minWidth: "300px",
  transition: "transform 0.2s ease",
  cursor: "pointer",
  ":hover": {
    transform: "scale(1.03)",
  }
};

const gameStatusStyle = {
  fontSize: "16px",
  fontWeight: "bold",
  marginTop: "10px",
  color: "#d32f2f",
};

const scoreContainer = { display: "flex", alignItems: "center", justifyContent: "center", gap: "70px" };
const teamContainer = { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" };
const teamLogo = { width: "40px", height: "40px" };
const scoreStyle = { fontSize: "20px", fontWeight: "bold" };
const gameTimeStyle = { fontSize: "16px", fontWeight: "bold", color: "gray" };

export default function App() {
  return (
    <Router>
      <Navbar /> {/* Status Bar Always on Top */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:gameId" element={<GameDetails />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/stat-leaders" element={<StatLeaders />} />
        <Route path="/playoffs" element={<Playoffs />} />
      </Routes>
    </Router>
  );
}