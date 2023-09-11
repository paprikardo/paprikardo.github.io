import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  ListItem,
  IconButton,
  ListItemText,
  Avatar,
  Divider,
  List,
  Typography,
  Box,
  ListItemIcon,
  ListItemButton,
  Drawer,
} from "@mui/material";
import {
  ArrowBack,
  AssignmentInd,
  Home,
  Apps,
  ContactMail,
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core";
import { color } from "@mui/system";
import avatar from "../profile.jpeg";

const brightColor = "#f0f6ff";
const myBlue = "#288bbd";

//CSS STYLES
const useStyles = makeStyles((theme) => ({
  menuSliderContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: 250,
    background: myBlue,
    height: "100%",
  },
  avatar: {
    display: "block",
    margin: "0.5rem auto",

    width: theme.spacing(13),
    height: theme.spacing(13),
  },
}));

const menuItems = [
  { listIcon: <Home />, listText: "Home" },
  { listIcon: <AssignmentInd />, listText: "Resume" },
  { listIcon: <Apps />, listText: "Others" },
];

const Navbar = (props) => {
  const [sidebarShown, setSidebarShown] = useState(false);
  const classes = useStyles();

  const sideList = (slider) => (
    <Box className={classes.menuSliderContainer} component="div">
      <Avatar
        sx={{ width: 56, height: 56 }}
        className={classes.avatar}
        src={avatar}
        alt="Ricardo Heinzmann"
        onClick={()=>setSidebarShown(false)}
      ></Avatar>
      <Divider />
      <List>
        {menuItems.map((lsItem, key) => (
          <ListItemButton key={key}>
            <ListItemIcon key={key + "icon"}>{lsItem.listIcon}</ListItemIcon>
            <ListItemText
              primary={lsItem.listText}
              key={key + "text"}
            ></ListItemText>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
  return (
    <>
      <Box component="nav">
        <AppBar position="static" style={{ background: "#288bbd" }}>
          <Toolbar>
            <IconButton onClick={()=> setSidebarShown(true)}>
              <ArrowBack style={{ color: brightColor }}></ArrowBack>
            </IconButton>
            <Typography variant="h5" style={{ color: brightColor }}>
              Portfolio
            </Typography>
            <Drawer open={sidebarShown} onClose={()=>setSidebarShown(false)}>{sideList("right")}</Drawer>
          </Toolbar>
        </AppBar>
      </Box>
    </>
  );
};

export default Navbar;
