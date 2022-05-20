const express = require('express');
const cors = require('cors');
const { json, set } = require('express/lib/response');
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
            const email = req.query.email;
            const query = { patient: email };
            const cursor = bookingCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
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