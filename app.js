const express = require('express');//return a function
const app = express();//express function returns app object 
var bodyParser = require('body-parser');
var bcrypt = require('bcryptjs');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var MongoClient = require('mongodb').MongoClient;//accessing mongoclient property
var url = 'mongodb://localhost:27017';
var db; var clo;
//connect method to connect to the server
MongoClient.connect(url, function (err, client) {
    if (err)
        throw err
    else {
        db = client.db('dailybiller');
        clo = client.close.bind(client);
        console.log('Connected to MongoDB');
        db.collection('newuser').createIndex({ email: 1 }, { unique: true });
    }
});
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
        else {
            res.send("inserted successfully");

        }
    });
});
var callback = function (resp, pwd, err, result) {
    if (err) throw new (err);
    var compareResult = bcrypt.compareSync(pwd, result.password);
    if (compareResult) {
        resp.send("login successfull");
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