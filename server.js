const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
process.env.MONGO_URI='mongodb+srv://<user>:<password>@cluster0.d0zls.mongodb.net/my-first-mongo?retryWrites=true&w=majority'
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
/*app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})*/

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

//User Schema and Model
var userSchema = new mongoose.Schema({
  username: String,
  count: Number,
  log: [{
    "description": String,
    "duration": Number,
    "date": String
  }]
});

var User = mongoose.model("User", userSchema);

//New User
app.post("/api/exercise/new-user", newUser)

function newUser (req, res, next) {
  let userName = req.body.username;

  User.findOne({"username": userName}, function(err, record){
    if (err) {
      res.send(err);
      return new Error(err);
    }
    else if (record) {
      res.send("Username already exists");
      return null;
    }
    else {
      let newUser = new User({username: userName});

      newUser.save(function(err, result){
        if (err) return new Error(err);
        let userInfo = result.id;
        res.send(result);
        //res.send("Success! New user registered. Your unique key is: " + userInfo); for actual human visibility
      });

      return null;
    }
  });
}

//Add exercise
app.post('/api/exercise/add', addExercise);

function addExercise (req, res, next) {
  let data = req.body;
  console.log("Adding exercise...")

  User.findById(data.userId, function(err, record){
    if (err) {
      res.send(err);
      return new Error(err);
    }
    let newLog = record["log"];

    if(!data.date){
      let today = new Date();
      today = [today.getFullYear(), today.getMonth()+1, 
              today.getDate()]
              .map(value => value<10?"0" + value.toString()                    :value.toString())
              .join("-");
      data.date = today;
      console.log(data.date);
    }

    newLog.push({
      "description": data.description,
      "duration": data.duration,
      "date": (new Date(data.date)).toString()
                                       .split(" ")
                                       .slice(0,4)
                                       .join(" ")
    });

    record["log"] = newLog;
    record["count"] = record["count"]?record["count"]+1:1;
    record.save(function(err, savedRecord){
      if(err) return new Error(err);
      let latest = savedRecord["log"][savedRecord["log"].length-1];
      res.json({
          "_id": savedRecord.id,
          "username": savedRecord.username,
          "description": latest.description,
          "duration": latest.duration,
          "date": latest.date
      })

      //res.send("Saved new exercise: " + latest);for actual human visibility
    })
  });
}

//User list
app.get('/api/exercise/users', userList)

function userList (req, res, next) {
  console.log("User list request");
  User.find({},'_id, name', function(err, result){
    res.send(result);
  });
}

//Get log
app.get('/api/exercise/log', getLog)

function getLog (req, res, next) {
  let data = req.query;
  console.log("Log request");
  if (!data.userId){
    console.log("No user entered.");
    res.send("No user entered.");
    return null;
  }

  User.findById(data.userId, function(err, record){
    if (err) {
      res.send(err); return new Error(err);
    } else if (record === null){
      res.send("User not found."); return null;
    }

    let userLog = Array.from(record["log"]);
    let tempRecord = record;

    if(data.from || data.to) {
      userLog = userLog.filter(entry => {
        if (entry.date) return true;
        else return false;
      });
      console.log("log filtered: " + userLog)
    }

    if (data.from) {
      userLog = userLog.filter(value => new Date(value.date) >= new Date(data.from));
    }
    if (data.to) {
      userLog = userLog.filter(value => new Date(value.date) <= new Date(data.to));
    }
    if (data.limit) {
      userLog = userLog.slice(0,data.limit);
    }

    tempRecord["log"] = userLog

    res.send(tempRecord);
  });
}

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
