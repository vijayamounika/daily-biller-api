const express = require("express"); //return a function
const app = express(); //express function returns app object
var bodyParser = require("body-parser");
var bcrypt = require("bcryptjs");
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var mongo = require("mongodb");
var MongoClient = require("mongodb").MongoClient; //accessing mongoclient property
var url = "mongodb://localhost:27017";
var db;
var clo;
var jwt = require("jsonwebtoken");
var path = require("path");
var config = require(path.resolve(__dirname, "./config.js"));
//connect method to connect to the server
MongoClient.connect(
  url,
  function(err, client) {
    if (err) throw err;
    else {
      db = client.db("dailybiller");
      clo = client.close.bind(client);
      console.log("Connected to MongoDB");
      db.collection("newuser").createIndex({ email: 1 }, { unique: true });
      db.collection("newSubscription").createIndex(
        { userid: 1, name: 1 },
        { unique: true }
      );
      //db.collection('dailySubscriptions').createIndex({ name: 1, subId: 1 }, { unique: true });
    }
  }
);
app.use("/auth/user", function(req, res, next) {
  var token = req.headers["x-access-token"];
  if (!token)
    return res.status(401).send({ auth: false, message: "No token provided." });
  jwt.verify(token, config.secret, function(err, decoded) {
    if (err)
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token" });
    db.collection("newuser").findOne(
      { _id: mongo.ObjectID(decoded.id) },
      { password: false },
      function(err, result) {
        if (err)
          return res.status(500).send("There was a problem finding the user");
        if (!result) return res.status(404).send("No user found");
        //res.status(200).send(result);
        req.user = result; //
        next();
      }
    );
  });
});
app.post("/auth/user/addNewSubscription", function(req, res, next) {
  var unitArray = ["kg", "litre", "bunch", "piece", "tin"];
  var name = req.body.name;
  var pricePerUnit = req.body.pricePerUnit;
  var quantity = req.body.quantity;
  var unit = req.body.unit;
  var subtype = req.body.subtype;
  var user_id = req.user._id;

  if (unitArray.includes(unit)) {
    var newSubscriptionData = {
      name: name,
      pricePerUnit: pricePerUnit,
      quantity: quantity,
      unit: unit,
      subType: subtype,
      userid: user_id
    };
    //removed try catch block and commented out user finding logic as we are verifying token and getting user from middleware function
    // db.collection('newuser').findOne({ "_id": mongo.ObjectID(user_id) }, function (err, result) {//when this error will come
    //     if (err) throw new Error(err);
    //     if (!result) {
    //         res.send("error occured");
    //     }
    db.collection("newSubscription").insert(newSubscriptionData, function(
      err,
      result
    ) {
      if (err) res.send("Error");
      //throw new Error("product name already exists with the requested user");
      else res.send("inserted successfully");
    });
  } else {
    throw new Error("please select a valid quantity");
  }
});
app.post("/userregistration", function(req, res) {
  var firstName = req.body.firstname;
  var lastName = req.body.lastname;
  var email = req.body.email;
  var gender = req.body.gender;
  var age = req.body.age;
  var password = req.body.password;
  var repeatPassword = req.body.repeatpassword;
  if (password !== repeatPassword) {
    throw new Error("password doesn't match");
  }
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
  var myData = {
    firstname: firstName,
    lastname: lastName,
    email: email,
    gender: gender,
    age: age,
    password: hash
  };
  db.collection("newuser").insert(myData, function(err, result) {
    if (err) {
      res.send(err);
    }
    var token = jwt.sign(
      { id: result.insertedIds[0].toString() },
      config.secret,
      { expiresIn: 86400 }
    );
    res.status(200).send({ auth: true, token: token });
  });
});
app.get("/me", function(req, res) {
  var token = req.headers["x-access-token"];
  if (!token)
    return res.status(401).send({ auth: false, message: "No token provided." });
  jwt.verify(token, config.secret, function(err, decoded) {
    if (err)
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token" });
    db.collection("newuser").findOne(
      { _id: mongo.ObjectID(decoded.id) },
      { password: false },
      function(err, result) {
        if (err)
          return res.status(500).send("There was a problem finding the user");
        if (!result) return res.status(404).send("No user found");
        res.status(200).send(result);
      }
    );
  });
});

var callback = function(resp, pwd, err, result) {
  if (err) throw new err();
  var compareResult = bcrypt.compareSync(pwd, result.password);
  if (compareResult) {
    var token = jwt.sign({ id: result._id }, config.secret, {
      expiresIn: 86400
    });
    resp
      .status(200)
      .send({ auth: true, token: token, message: "Login Successfull" });
    // resp.send("login successfull");
  } else {
    resp.send("password is incorrect");
  }
};
app.post("/login", function(req, res) {
  var username = req.body.username;
  var pwd = req.body.password;
  var example = callback.bind(null, res, pwd);
  var doc = db.collection("newuser").findOne({ firstname: username }, example);
});
app.post("/auth/user/subscriptions/getall", function(req, res) {
  db.collection("newSubscription")
    .find({ userid: req.user._id })
    .toArray(function(err, docs) {
      if (err) throw new Error("error");
      if (!err) {
        if (docs.length > 0) res.send(docs);
      }
    });
});
app.post("/auth/user/subscription/update", function(req, res) {
  var subscriptionId = req.body.subscriptionId;
  db.collection("newSubscription").findOne(
    { _id: mongo.ObjectID(subscriptionId) },
    function(err, result) {
      if (err) throw new Error("There is no subscription for the requested id");
      if (result) {
        db.collection("newSubscription").update(
          { _id: mongo.ObjectID(subscriptionId) },
          { $set: { pricePerUnit: 58 } },
          function(err, result) {
            if (err) throw new Error("error");
            if (result) res.send("updated successfully");
            else throw new Error("error");
          }
        );
      } else res.send("No such subscription");
    }
  );
});
app.post("/auth/user/subscription/delete", validateSubscriptionId, function(
  req,
  res
) {
  var subscriptionId = req.body.subscriptionId;
  db.collection("newSubscription").remove({
    _id: mongo.ObjectID(subscriptionId)
  });
  res.send("deleted successfully");
});
function validateSubscriptionId(req, res, next) {
  var subId = req.body.subscriptionId;
  db.collection("newSubscription").findOne(
    { userid: req.user._id, _id: mongo.ObjectId(subId) },
    function(err, result) {
      if (err) throw new Error("error");
      if (result) {
        req.subscription = result;
        next();
      } else throw new Error("There is no subscription with the requested id");
    }
  );
}
function getSpecificDate(req, res, next) {
  var subId = req.body.subscriptionId;
  var date1 = new Date(req.body.date);
  var givenDate = date1.getDate() + 1;
  var givenMonth = date1.getMonth() + 1;
  var givenYear = date1.getFullYear();
  var str1 = req.body.date;
  if (givenMonth < 10) {
    givenMonth = "0" + givenMonth;
  }
  var str = (str = givenYear + "-" + givenMonth + "-" + givenDate);
  var date2 = new Date(str);

  db.collection("dailySubscriptions")
    .find({ subId: subId, date: { $gte: new Date(str1), $lt: new Date(str) } })
    .toArray(function(err, result) {
      if (err) throw new Error("Error");
      if (result) {
        req.recordOnDate = result;
        next();
      } else throw new Error("There is no subscription tracking for the requested one");
    });
}
app.post("/auth/user/dailySubscriptionTrack", function(req, res) {
  var subId = req.body.subscriptionId;
  var prName = req.body.name;

  db.collection("newSubscription").findOne(
    { _id: mongo.ObjectID(subId), name: prName },
    function(err, docs) {
      if (err) throw new Error("Error occurred");
      if (docs) {
        var quantity = req.body.quantity;
        if (docs.subType == "daily") {
          if (req.body.priceperunit) {
            costperunit = req.body.priceperunit;
          } else {
            throw new Error("please enter price per unit");
          }
        } else costperunit = docs.pricePerUnit;

        var day = new Date().getDate();
        var month = new Date().getMonth() + 1;
        if (month < 10) {
          month = "0" + month;
        }
        var year = new Date().getFullYear();
        dateString = 2018 + "-" + "0" + 9 + "-" + 24 + "T00:00:00.000Z";
        var mydate = new Date(dateString);
        myDailySubscription = {
          name: prName,
          date: mydate,
          quantity: quantity,
          cost: costperunit,
          subId: subId
        };
        db.collection("dailySubscriptions")
          .find({
            $and: [{ $expr: { $eq: ["$date", mydate] } }, { name: prName }]
          })
          .toArray(function(err, result) {
            // db.collection('dailySubscriptions').find({ "name": prName, "date": day }).toArray(function (err, result) {
            if (err) throw new Error("Error");
            if (result.length > 0)
              res.send(
                "Cannot create two daily subscriptions on a single date, please update to change"
              );
            else {
              db.collection("dailySubscriptions").insertOne(
                myDailySubscription,
                function(err, result) {
                  if (err) throw new Error("error");
                  if (result) {
                    res.send("successfully inserted");
                  } else res.send("Error occurred while tracking");
                }
              );
            }
          });
      }
    }
  );
});
app.post("/auth/user/newSubscriptionUpdate", validateSubscriptionId, function(
  req,
  res
) {
  if (req.subscription.subType === "monthly") {
    var pricePerUnit = req.body.priceperunit;
    db.collection("newSubscription").update(
      { _id: req.subscription._id },
      { $set: { pricePerUnit: pricePerUnit } },
      function(err, result) {
        if (req.body.fromdate) {
          var subId = req.body.subscriptionId;
          var fromdate = req.body.fromdate;
          db.collection("dailySubscriptions").updateMany(
            {
              subId: subId,
              date: { $gte: new Date(fromdate), $lt: new Date() }
            },
            { $set: { cost: pricePerUnit } },
            function(err, result) {
              if (err) throw new Error("error");
              if (result) {
                res.send("updated succesfully");
              }
            }
          );
        }
      }
    );
  } else {
    throw new Error("Error");
  }
});
app.post(
  "/auth/user/getSpecificDateSubscriptionAndUpdate",
  validateSubscriptionId,
  getSpecificDate,
  function(req, res) {
    var quantity = req.body.quantity;
    db.collection("dailySubscriptions").update(
      { _id: req.recordOnDate[0]._id },
      { $set: { quantity: quantity } },
      function(err, result) {
        if (err) throw new Error("error");
        if (result) res.send("updated successfully");
        else throw new Error("error");
      }
    );
  }
);
app.post(
  "/auth/user/getSpecificDateSubscriptionAndDelete",
  validateSubscriptionId,
  getSpecificDate,
  function(req, res) {
    db.collection("dailySubscriptions").remove({
      _id: req.recordOnDate[0]._id
    });
    res.send("Deleted successfully");
  }
);
app.post(
  "/auth/user/getTillDateSubscriptionCost",
  validateSubscriptionId,
  function(req, res) {
    var subId = req.body.subscriptionId;
    var month = req.body.month;
    db.collection("dailySubscriptions")
      .find({ subId: subId }, { $expr: { $eq: [{ $month: month }] } })
      .toArray(function(err, docs) {
        if (err) throw new Error("error");
        if (docs.length > 0) {
          var totalCostTillDate = 0;
          var arr = [];
          for (var i = 0; i < docs.length; i++) {
            var obj = {
              date: docs[i].date,
              quantity: docs[i].quantity
            };
            arr.push(obj);
          }
          //   var obj1 = {
          //     userId: req.user._id,
          //     subId: subId,
          //     month: month,
          //     cost: totalCostTillDate,
          //     entries: docs.length
          //   };
          var myJson = JSON.stringify(arr);
          res.send(myJson);
        } else res.send("Error");
      });
  }
);
app.post(
  "/auth/user/getSpecifiedDateSubscriptions",
  validateSubscriptionId,
  getSpecificDate,
  function(req, res) {
    if (req.user) {
      var myJson1 = JSON.stringify(req.user);
      res.send(myJson1);
    } else throw new Error("Error");
  }
);

app.get("/", (req, res) => res.send("Hello world"));
app.get("/home", (req, res) => res.json({ message: "hurray, you did it" }));
app.get("/login", function(req, res) {
  var user_id = req.query.username;
  var password = req.query.password;
  res.send(user_id + " " + password);
});
app.post("/users", function(req, res) {
  var user_id = req.body.username;
  var password = req.body.password;
  res.send(user_id + " " + password);
});
app.get("/users/:username/:password", function(req, res) {
  res.send(req.params.username);
});
app.listen(3000, () => console.log("Example is listening on port 3000"));
