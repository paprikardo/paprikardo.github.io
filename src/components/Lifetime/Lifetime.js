import React, { useState } from "react";
import "./Lifetime.css";
import { Box, Container, TextField, Typography } from "@mui/material";
import LifePhases from "./LifePhases";

const backgroundWithOpacity = "rgba(46, 58, 64 ,0.6)";
const brightColor = "#f0f6ff";

const Lifetime = () => {
  const [trackSetting, setTrackSetting] = useState({
    day: "10",
    month: "12",
    year: "2001",
    expAge: "80",
    tooOldAge: "70",
  });
  const newDate = new Date();

  const checkSettings = (state) => {
    console.log(state);
    if (
      //check valid input
      state.year.length == 4 &&
      (state.month.length == 1 || state.month.length == 2) &&
      (state.day.length == 1 || state.day.length == 2) &&
      //check date before today
      (state.year < newDate.getFullYear() ||
      (state.year == newDate.getFullYear() &&
        state.month < newDate.getMonth() + 1) || //getMonth returns values from 0 to 11
        (state.year == newDate.getFullYear() &&
          state.month == newDate.getMonth() + 1 &&
          state.day < newDate.getDate())) &&
      //check valid values
      state.year > 1800 &&
      state.month > 0 &&
      state.month < 13 &&
      state.day > 0 &&
      state.day < 33 &&
      state.expAge < 501 &&
      state.expAge > 0 &&
      state.tooOldAge > 0 &&
      state.tooOldAge < 501
    ) {
      return true;
    } else {
      console.log(
        "ERROR", //check valid input
        state.year.length == 4 &&
          (state.month.length == 1 || state.month.length == 2) &&
          (state.day.length == 1 || state.month.length == 2)
      );

      console.log(
        "date",
        state.year < newDate.getFullYear() ||
        (state.year == newDate.getFullYear() &&
          state.month < newDate.getMonth() + 1) || //getMonth returns values from 0 to 11
          (state.year == newDate.getFullYear() &&
            state.month == newDate.getMonth() + 1 &&
            state.day < newDate.getDate()),
        newDate.getDate(),
        newDate.getMonth(),
        newDate.getFullYear()
      );
      console.log(
        "length",
        state.year.length == 4 &&
          (state.month.length == 1 || state.month.length == 2) &&
          (state.day.length == 1 || state.day.length == 2),
        state.month.length,
        state.month.length == 1 || state.month.length == 2
      );
      console.log(
        "valid values",
        state.year > 1800 &&
          state.month > 0 &&
          state.month < 13 &&
          state.day > 0 &&
          state.day < 33 &&
          state.expAge < 501 &&
          state.expAge > 0 &&
          state.tooOldAge > 0 &&
          state.tooOldAge < 501,
        state.month > 0 && state.month < 13,
        state.day > 0 && state.day < 33
      );
      return false;
    }
  };

  return (
    <Container
      maxWidth="md"
      style={{
        backgroundColor: backgroundWithOpacity,
        backdropFilter: "blur(2px)",
        borderRadius: "20px",
        outline: "1px solid",
        outlineColor: brightColor,
        marginTop: "20px",
        paddingTop: "5%",
        paddingBottom: "5%",
      }}
    >
      <Container maxWidth="sm">
        <Typography
          variant="h4"
          style={{ color: brightColor, textAlign: "center" }}
        >
          Lifetime Calculator
        </Typography>
        <Typography variant="p" style={{ color: brightColor }}>
          One only has limited time to live. When you calculate the amount of
          weeks that you are about to live, your life suddenly feels short.
        </Typography>
        <br></br>
        <Typography variant="p" style={{ color: brightColor }}>
          Enter your birthday, your expected age of death (Average in
          Switzerland is 82 for men and 86 for women) and the "Inactive age"
          where you will lack body fitness.
        </Typography>
        <Box
          sx={{
            marginTop: "10px",
            display: "flex",
            justifyContent: "space-evenly",
          }}
        >
          <TextField
            key="day"
            label="Day"
            type="number"
            value={trackSetting.day}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.day = event.target.value;
              setTrackSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
          <TextField
            key="month"
            label="Month"
            type="number"
            value={trackSetting.month}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.month = event.target.value;
              setTrackSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
          <TextField
            key="year"
            label="Year"
            type="number"
            value={trackSetting.year}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.year = event.target.value;
              setTrackSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
        </Box>
        <Box sx={{ marginTop: "10px", justifyContent: "space-evenly" }}>
          <TextField
            label="Expected Age of death"
            type="number"
            value={trackSetting.expAge}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.expAge = event.target.value;
              setTrackSetting(newState);
            }}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
          />
          <TextField
            label="Inactive Age"
            type="number"
            value={trackSetting.tooOldAge}
            sx={{ input: { color: brightColor } }}
            InputLabelProps={{ style: { color: brightColor } }}
            onChange={(event) => {
              const newState = { ...trackSetting };
              newState.tooOldAge = event.target.value;
              setTrackSetting(newState);
            }}
          />
        </Box>
        <Box sx={{ marginTop: "10px" }}>
          <Typography variant="p" style={{ color: brightColor }}>
            Below represented is your expected time in your life. Each dot
            represents one week. Each row is 52 weeks which is roughly one year.
          </Typography>
        </Box>
        <Box className="legendeBigContainer">
          <Box className="legendeContainer">
            <Box className="childhood"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Childhood (until age of 12)
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="teenager"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Teenager Time (until age of 20)
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="adult"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Adulthood
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="retired"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Time retired{" "}
            </Box>
          </Box>
          <Box className="legendeContainer">
            <Box className="tooOld"></Box>
            <Box className="legendeText" style={{ color: brightColor }}>
              Your Time inactive
            </Box>
          </Box>
        </Box>
        {checkSettings(trackSetting) ? (
          <LifePhases
            expAge={trackSetting.expAge}
            birthDay={trackSetting.day}
            birthMonth={trackSetting.month}
            birthYear={trackSetting.year}
            tooOldAge={trackSetting.tooOldAge}
          ></LifePhases>
        ) : (
          "Invalid Values"
        )}
        <Box sx={{ marginTop: "20px" }}>
          <Typography variant="p" style={{ color: brightColor }}>
            This might feel intimidating. But it can also serve as a motivation
            to not miss out on the things that you really want to do. Life is
            too short to not commit to the things that you love.
          </Typography>
        </Box>
      </Container>
    </Container>
  );
};

export default Lifetime;
