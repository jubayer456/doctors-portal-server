const express = require('express');
const cors = require('cors');
const { json, set } = require('express/lib/response');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { decode } = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ messasge: 'Unauthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECREET, function (error, decoded) {
        if (error) {
            return res.status(403).send({ messasge: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.8hmdt.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const run = async () => {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('user');
        //get
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        //post
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });
        })

        //get
        app.get('/users', verifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        //get
        app.get('/booking', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { patient: email };
                const cursor = bookingCollection.find(query);
                const result = await cursor.toArray();
                return res.send(result);
            }
            else {
                return res.status(403).send({ messasge: 'Forbidden Access' })
            }

        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email: email });
            const isAdmin = result.role === 'admin';
            res.send({ admin: isAdmin });
        })


        //admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAcount = await userCollection.findOne({ email: requester });
            if (requesterAcount.role === 'admin') {
                console.log("admin");
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' }
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                return res.send(result);
            }
            else {
                return res.status(403).send({ messasge: 'Forbidden Access' })
            }

        })




        //put
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECREET, { expiresIn: '1d' });
            res.send({ result, token });
        })

        //
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 17, 2022';

            //step-1 get all the service
            const services = await serviceCollection.find().toArray();
            //step-2 
            console.log(date);
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            //step-3
            services.forEach(service => {
                //step-4
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                //step-5
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step-6
                service.booked = bookedSlots;
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            })
            res.send(services);
        })

    }
    finally {
        //client.close()
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("Start doctors portal");
})
app.listen(port, (req, res) => {
    console.log("server is running", port);
})