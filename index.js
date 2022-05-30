const express = require('express');
const cors = require('cors');
const { json, set } = require('express/lib/response');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { decode } = require('jsonwebtoken');
const stripe = require('stripe')('sk_test_51L4JARD2IOxGf7i4UkAomutSVfeXvK6IVf9GLeETieP3tINuBoPKevF4H8AEwe54rk96DuTmIoQFYqzkrlE6fcSm00Fu7fzHtz');
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
        const doctorCollection = client.db('doctors_portal').collection('doctor');
        const paymentCollection = client.db('doctors_portal').collection('payment');
        //get
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const result = await cursor.toArray();
            res.send(result);
        })

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAcount = await userCollection.findOne({ email: requester });
            if (requesterAcount.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ messasge: 'Forbidden Access' })
            }
        }

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
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAcount = await userCollection.findOne({ email: requester });
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            return res.send(result);
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
            const date = req.query.date;

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

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })
        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await doctorCollection.find().toArray();
            res.send(result);
        })
        app.delete('/doctor/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatingBooking = await bookingCollection.updateOne(filter, updatedDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updatingBooking);
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