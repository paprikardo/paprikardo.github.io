import { Box, Grid, Tooltip } from "@mui/material";
import React from "react";
import "./Lifetime.css";
//return num (rounded to nearest integer) strings of the style text
const getNStrings = (num, style) => {
  if (num <= 0) {
    return [];
  }
  return [...Array(Math.round(num)).keys()].map((id) => {
    return style;
  });
};

//converts the number of years to number of weeks
const yearsToWeeks = (num) => num * 52.14286;

const chunkBy52 = (array) => {
  const chunkSize = 52;
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result.push(chunk);
  }
  return result;
};

//fills the array up so that each row has 52 dots
const fillBy52 = (array, tooAdd) => {
  const lastRowLength = array[array.length - 1].length;
  if (lastRowLength < 52) {
    array[array.length - 1] = array[array.length - 1].concat(
      tooAdd.slice(0, 52 - lastRowLength)
    );
    for (var i = 0; i < 52 - lastRowLength; i++) {
      if (tooAdd.length === 0) {
      }
      tooAdd.shift();
    }
  }
  return array.concat(chunkBy52(tooAdd));
};

const LifePhases = (props) => {
  //calculate and populate the dots
  const childAge = 12; //assuming child until 12 years
  const teenagerAge = 21; //assuming teenager until 20 years
  const retiredAge = 65; //assuming retired with 65 years
  const childhoodDots = getNStrings(
    yearsToWeeks(props.expAge < childAge ? props.expAge : childAge),
    "childhood"
  );
  const teenagerDots = getNStrings(
    yearsToWeeks(
      props.expAge < teenagerAge
        ? props.expAge - childAge
        : teenagerAge - childAge
    ),
    "teenager"
  );
  const adultDots = getNStrings(
    yearsToWeeks(
      props.expAge < retiredAge
        ? props.expAge - teenagerAge
        : retiredAge - teenagerAge
    ),
    "adult"
  );
  const retiredDots = getNStrings(
    yearsToWeeks(
      props.expAge < props.tooOldAge
        ? props.expAge - retiredAge
        : props.tooOldAge - retiredAge
    ),
    "retired"
  );
  const tooOldDots = getNStrings(
    yearsToWeeks(props.expAge - props.tooOldAge),
    "tooOld"
  );
  var dotsByYear = [[]];
  dotsByYear = fillBy52(dotsByYear, childhoodDots);
  dotsByYear = fillBy52(dotsByYear, teenagerDots);
  dotsByYear = fillBy52(dotsByYear, adultDots);
  dotsByYear = fillBy52(dotsByYear, retiredDots);
  dotsByYear = fillBy52(dotsByYear, tooOldDots);
  //add in the todays week
  const newDate = new Date();
  const numDaysSinceBirth =
    newDate.getDate() -
    props.birthDay +
    (newDate.getMonth() + 1 - props.birthMonth) * 30.437 + //30.437 is average month length, getMonth returns values from 0 to 11
    (newDate.getFullYear() - props.birthYear) * 365;
  const numWeeksSinceBirth = Math.floor(numDaysSinceBirth / 7);
  const index1 = Math.floor(numWeeksSinceBirth / 52);
  const index2 = Math.round(numWeeksSinceBirth % 52);
  if (index1 < dotsByYear.length) {
    if (index2 < dotsByYear[index1].length) {
      dotsByYear[index1][index2] = "youarehere";
    }
  }
  console.log(yearsToWeeks(1))
  return (
    <Grid
      container
      direction="column"
      alignItems="center"
      style={{ marginTop: "20px" }}
    >
      {dotsByYear.map((year, key) => (
        <Grid item container key={key} justifyContent="center">
          <Box sx={{ display: "flex", flexDirection: "row" }}>
            {year.map((style, id) => {
              if (style !== "youarehere") {
                return <Box key={id + style} className={style}></Box>;
              } else {
                return (
                  <Tooltip
                    key={id + style}
                    open
                    arrow
                    placement="right"
                    title="You are here"
                  >
                    <Box className={style}></Box>
                  </Tooltip>
                );
              }
            })}
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};

export default LifePhases;
