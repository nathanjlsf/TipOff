import React from "react";
import { Link } from "react-router-dom";

const DIVISIONS = {
  "Atlantic Division": [
    { name: "Boston Celtics", code: "BOS", id: 1610612738 },
    { name: "Brooklyn Nets", code: "BKN", id: 1610612751 },
    { name: "New York Knicks", code: "NYK", id: 1610612752 },
    { name: "Philadelphia 76ers", code: "PHI", id: 1610612755 },
    { name: "Toronto Raptors", code: "TOR", id: 1610612761 }
  ],
  "Central Division": [
    { name: "Chicago Bulls", code: "CHI", id: 1610612741 },
    { name: "Cleveland Cavaliers", code: "CLE", id: 1610612739 },
    { name: "Detroit Pistons", code: "DET", id: 1610612765 },
    { name: "Indiana Pacers", code: "IND", id: 1610612754 },
    { name: "Milwaukee Bucks", code: "MIL", id: 1610612749 }
  ],
  "Southeast Division": [
    { name: "Atlanta Hawks", code: "ATL", id: 1610612737 },
    { name: "Charlotte Hornets", code: "CHA", id: 1610612766 },
    { name: "Miami Heat", code: "MIA", id: 1610612748 },
    { name: "Orlando Magic", code: "ORL", id: 1610612753 },
    { name: "Washington Wizards", code: "WAS", id: 1610612764 }
  ],
  "Northwest Division": [
    { name: "Denver Nuggets", code: "DEN", id: 1610612743 },
    { name: "Minnesota Timberwolves", code: "MIN", id: 1610612750 },
    { name: "Oklahoma City Thunder", code: "OKC", id: 1610612760 },
    { name: "Portland Trail Blazers", code: "POR", id: 1610612757 },
    { name: "Utah Jazz", code: "UTA", id: 1610612762 }
  ],
  "Pacific Division": [
    { name: "Golden State Warriors", code: "GSW", id: 1610612744 },
    { name: "LA Clippers", code: "LAC", id: 1610612746 },
    { name: "Los Angeles Lakers", code: "LAL", id: 1610612747 },
    { name: "Phoenix Suns", code: "PHX", id: 1610612756 },
    { name: "Sacramento Kings", code: "SAC", id: 1610612758 }
  ],
  "Southwest Division": [
    { name: "Dallas Mavericks", code: "DAL", id: 1610612742 },
    { name: "Houston Rockets", code: "HOU", id: 1610612745 },
    { name: "Memphis Grizzlies", code: "MEM", id: 1610612763 },
    { name: "New Orleans Pelicans", code: "NOP", id: 1610612740 },
    { name: "San Antonio Spurs", code: "SAS", id: 1610612759 }
  ]
};

export default function Teams() {
  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>🏀 NBA Teams by Division</h2>
      {Object.entries(DIVISIONS).map(([division, teams]) => (
        <div key={division} style={divisionBlock}>
          <h3 style={divisionTitle}>{division}</h3>
          <ul style={listStyle}>
            {teams.map((team) => (
              <li key={team.code} style={itemStyle}>
                <Link to={`/teams/${team.code}`} style={linkStyle}>
                  <img
                    src={`https://cdn.nba.com/logos/nba/${team.id}/primary/L/logo.svg`}
                    alt={`${team.name} logo`}
                    style={logoStyle}
                  />
                  {team.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
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

const headerStyle = {
  textAlign: "center",
  marginBottom: "30px",
};

const divisionBlock = {
  marginBottom: "40px",
};

const divisionTitle = {
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

const linkStyle = {
  textDecoration: "none",
  color: "#007bff",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
};

const logoStyle = {
  width: "40px",
  height: "40px",
  marginRight: "10px",
  verticalAlign: "middle",
};