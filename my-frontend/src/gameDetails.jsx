import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

function GameDetails() {
  const { gameId } = useParams(); // Get the gameId from the URL
  const [gameDetails, setGameDetails] = useState(null);
  
  useEffect(() => {
    // Fetch game details based on the gameId
    const fetchGameDetails = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/game-boxscore/${gameId}`);
        const data = await response.json();
        setGameDetails(data);
      } catch (error) {
        console.error("❌ Error fetching game details:", error);
      }
    };

    fetchGameDetails();
  }, [gameId]);

  if (!gameDetails) return <p>Loading game details...</p>;

  return (
    <div>
      <h2>Game Details: {gameDetails.gameId}</h2>
      <div>
        <h3>{gameDetails.homeTeam.teamName} vs {gameDetails.awayTeam.teamName}</h3>
        <p>Score: {gameDetails.homeTeam.score} - {gameDetails.awayTeam.score}</p>
        {/* Add more details as needed */}
      </div>
    </div>
  );
}

export default GameDetails;
