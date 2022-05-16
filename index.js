const express = require('express');
const cors = require('cors');
const { json } = require('express/lib/response');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());



const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.8hmdt.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const run = async () => {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
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
        app.get('/booking', async (req, res) => {
            const query = {};
            const cursor = bookingCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
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