const express = require('express');//return a function
const app = express();//express function returns app object 
var bodyParser = require('body-parser');
var bcrypt = require('bcryptjs');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var mongo = require("mongodb");
var MongoClient = require('mongodb').MongoClient;//accessing mongoclient property
var url = 'mongodb://localhost:27017';
var db; var clo;
var jwt = require('jsonwebtoken');
var path = require('path');
var config = require(path.resolve(__dirname, "./config.js"));
//connect method to connect to the server
MongoClient.connect(url, function (err, client) {
    if (err)
        throw err
    else {
        db = client.db('dailybiller');
        clo = client.close.bind(client);
        console.log('Connected to MongoDB');
        db.collection('newuser').createIndex({ email: 1 }, { unique: true });
        db.collection('newSubscription').createIndex({ userid: 1, name: 1 }, { unique: true });

    }
});
app.use('/auth/user', function (req, res, next) {
    var token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });
    jwt.verify(token, config.secret, function (err, decoded) {
        if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token' });
        db.collection('newuser').findOne({ "_id": mongo.ObjectID(decoded.id) }, { "password": false }, function (err, result) {
            if (err) return res.status(500).send("There was a problem finding the user");
            if (!result) return res.status(404).send("No user found");
            //res.status(200).send(result);
            req.user = result//
            next();
        })
    })
})
app.post('/auth/user/addNewSubscription', function (req, res, next) {
    var unitArray = ["kg", "litre", "bunch", "piece", "tin"];
    var name = req.body.name;
    var pricePerUnit = req.body.pricePerUnit;
    var quantity = req.body.quantity;
    var unit = req.body.unit;
    var user_id = req.user._id;

    if (unitArray.includes(unit)) {
        var newSubscriptionData = {
            name: name,
            pricePerUnit: pricePerUnit,
            quantity: quantity,
            unit: unit,
            userid: user_id
        };
        //removed try catch block and commented out user finding logic as we are verifying token and getting user from middleware function
        // db.collection('newuser').findOne({ "_id": mongo.ObjectID(user_id) }, function (err, result) {//when this error will come
        //     if (err) throw new Error(err);
        //     if (!result) {
        //         res.send("error occured");
        //     }
        db.collection('newSubscription').insert(newSubscriptionData, function (err, result) {
            if (err) res.send("Error");//throw new Error("product name already exists with the requested user");
            else res.send("inserted successfully");
        });
    }
    else {
        throw new Error("please select a valid quantity");
    }
})
app.post('/userregistration', function (req, res) {
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
    db.collection('newuser').insert(myData, function (err, result) {
        if (err) {
            res.send(err);
        }
        var token = jwt.sign({ id: result.insertedIds[0].toString() }, config.secret, { expiresIn: 86400 });
        res.status(200).send({ auth: true, token: token });
    });
});
app.get('/me', function (req, res) {
    var token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });
    jwt.verify(token, config.secret, function (err, decoded) {
        if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token' });
        db.collection('newuser').findOne({ "_id": mongo.ObjectID(decoded.id) }, { "password": false }, function (err, result) {
            if (err) return res.status(500).send("There was a problem finding the user");
            if (!result) return res.status(404).send("No user found");
            res.status(200).send(result);
        })
    })
})

var callback = function (resp, pwd, err, result) {
    if (err) throw new (err);
    var compareResult = bcrypt.compareSync(pwd, result.password);
    if (compareResult) {
        var token = jwt.sign({ id: result._id }, config.secret, { expiresIn: 86400 });
        resp.status(200).send({ auth: true, token: token, message: "Login Successfull" });
        // resp.send("login successfull");
    }
    else {
        resp.send("password is incorrect");
    }
}
app.post('/login', function (req, res) {
    var username = req.body.username;
    var pwd = req.body.password;
    var example = callback.bind(null, res, pwd);
    var doc = db.collection('newuser').findOne({ firstname: username },
        example);
});
app.post('/auth/user/subscriptions/getall', function (req, res) {
    db.collection('newSubscription').find({ "userid": req.user._id }).toArray(function (err, docs) {
        if (err) throw new Error("error");
        if (!err) {
            if (docs.length > 0)
                res.send(docs);
        }
    })
})
app.post('/auth/user/subscription/update', function (req, res) {
    var subscriptionId = req.body.subscriptionId;
    db.collection('newSubscription').findOne({ "_id": mongo.ObjectID(subscriptionId) }, function (err, result) {
        if (err) throw new Error("There is no subscription for the requested id");
        if (result) {
            db.collection('newSubscription').update({ "_id": mongo.ObjectID(subscriptionId) }, { $set: { "pricePerUnit": 58 } });

        }
        else res.send("No such subscription");
        res.send("updated successfully");
    })
})
app.post('/auth/user/subscription/delete', function (req, res) {
    var subscriptionId = req.body.subscriptionId;
    db.collection('newSubscription').findOne({ "_id": mongo.ObjectID(subscriptionId) }, function (err, result) {
        if (err) throw new Error("There is no subscription for the requested id");
        if (result) {
            db.collection('newSubscription').remove({ "_id": mongo.ObjectID(subscriptionId) });
        }
        res.send("deleted successfully");
    })
})
app.get('/', (req, res) => res.send("Hello world"));
app.get('/home', (req, res) => res.json({ message: "hurray, you did it" }));
app.get('/login', function (req, res) {
    var user_id = req.query.username;
    var password = req.query.password;
    res.send(user_id + " " + password);
});
app.post('/users', function (req, res) {
    var user_id = req.body.username;
    var password = req.body.password;
    res.send(user_id + " " + password);
});
app.get('/users/:username/:password', function (req, res) {
    res.send(req.params.username);
});
app.listen(3000, () => console.log('Example is listening on port 3000'));