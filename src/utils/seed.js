import bcrypt from 'bcryptjs';

import { User } from '../models/User.js';
import { Studio } from '../models/Studio.js';
import { Review } from '../models/Review.js';
import { Booking } from '../models/Booking.js';
import { Wishlist } from '../models/Wishlist.js';
import { roundMoney, timeToMinutes } from './helpers.js';

const img = (id, width = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

const dateFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const DEMO_PASSWORD = 'Studio123';

const people = [
  {
    key: 'examiner',
    name: 'Alex Rivera',
    email: 'examiner@studiosspace.com',
    photoURL: img('1494790108377-be9c29b29330', 400),
  },
  {
    key: 'host',
    name: 'Maya Chen',
    email: 'host@studiosspace.com',
    photoURL: img('1534528741775-53994a69daeb', 400),
  },
  {
    key: 'leo',
    name: 'Leo Park',
    email: 'leo@studiosspace.com',
    photoURL: img('1507003211169-0a1dd7228f2d', 400),
  },
  {
    key: 'jordan',
    name: 'Jordan Blake',
    email: 'jordan@studiosspace.com',
    photoURL: img('1500648767791-00dcc994a43e', 400),
  },
  {
    key: 'priya',
    name: 'Priya Nair',
    email: 'priya@studiosspace.com',
    photoURL: img('1517841905240-472988babdf9', 400),
  },
  {
    key: 'noah',
    name: 'Noah Williams',
    email: 'noah@studiosspace.com',
    photoURL: '',
  },
];

const byKey = Object.fromEntries(people.map((person) => [person.key, person]));

const studios = [
  {
    key: 'daylight',
    title: 'The Daylight Loft',
    category: 'Photo Studio',
    hourlyRate: 85,
    securityDeposit: 200,
    capacity: 12,
    location: 'Bushwick, Brooklyn, NY',
    imageURL: img('1554941829-202a0b2403b8'),
    images: [
      img('1554941829-202a0b2403b8'),
      img('1516035069371-29a1b244cc32'),
      img('1520390138845-fd2d229dd553'),
    ],
    amenities: ['Natural light', 'Cyc wall', 'Backdrops', 'Lighting kit', 'Makeup room', 'Wi-Fi'],
    overview:
      'A sun-drenched loft with twelve-foot factory windows, a seamless white cyc wall and a dedicated styling corner. The space is a five-minute walk from the Jefferson St stop and comes with C-stands, sandbags and a rolling garment rack ready for editorial or e-commerce shoots.',
    owner: 'host',
  },
  {
    key: 'warehouse9',
    title: 'Warehouse 9 Sound Stage',
    category: 'Sound Stage',
    hourlyRate: 140,
    securityDeposit: 500,
    capacity: 40,
    location: 'Greenpoint, Brooklyn, NY',
    imageURL: img('1497366811353-6870744d04b2'),
    images: [
      img('1497366811353-6870744d04b2'),
      img('1485846234645-a62644f84728'),
      img('1542204165-65bf26472b9b'),
    ],
    amenities: [
      'Green screen',
      'Freight access',
      'Lighting kit',
      'Parking',
      'Loading dock',
      'Air conditioning',
    ],
    overview:
      'A 3,000 sq ft clear-span stage with a 14-foot green screen, 400 amps of power and a drive-in freight door. Ideal for commercial shoots, music videos and multi-camera sets. A production office and green room are included with every full-day booking.',
    owner: 'host',
  },
  {
    key: 'quietroom',
    title: 'The Quiet Room',
    category: 'Podcast Room',
    hourlyRate: 55,
    securityDeposit: 100,
    capacity: 4,
    location: 'SoHo, Manhattan, NY',
    imageURL: img('1589903308904-1010c2294adc'),
    images: [
      img('1589903308904-1010c2294adc'),
      img('1478737270239-2f02b77fc618'),
      img('1598488035139-bdbb2231ce04'),
    ],
    amenities: ['Pro audio', 'Microphones', 'Seating lounge', 'Wi-Fi', 'Air conditioning'],
    overview:
      'A treated recording room built for conversation. Shure and Electro-Voice mics are patched into a RODECaster Pro, with four headphones and a guest lounge outside the booth. Perfect for interviews, narrative shows and remote co-hosts.',
    owner: 'host',
  },
  {
    key: 'amber',
    title: 'Amber Audio Suite',
    category: 'Music Suite',
    hourlyRate: 75,
    securityDeposit: 150,
    capacity: 6,
    location: 'Williamsburg, Brooklyn, NY',
    imageURL: img('1598488035139-bdbb2231ce04'),
    images: [
      img('1598488035139-bdbb2231ce04'),
      img('1519892300165-cb5542fb47c7'),
      img('1571330735066-03aaa9429d89'),
    ],
    amenities: ['Mixing console', 'Instruments', 'Pro audio', 'Kitchenette', 'Air conditioning'],
    overview:
      'A warm, wood-lined control room with an Audient console, Genelec monitors and a curated backline. Vocals, demos and full-band tracking all work here, and the host can bring in an engineer on request.',
    owner: 'host',
  },
  {
    key: 'sunroom',
    title: 'Sunroom Ceramics',
    category: 'Art Workshop',
    hourlyRate: 60,
    securityDeposit: 120,
    capacity: 10,
    location: 'Gowanus, Brooklyn, NY',
    imageURL: img('1493106641515-6b5631de4bb9'),
    images: [
      img('1493106641515-6b5631de4bb9'),
      img('1610701596007-11502861dcfa'),
      img('1578749556568-bc2c40e68b61'),
    ],
    amenities: ['Natural light', 'Seating lounge', 'Wi-Fi', 'Kitchenette', 'Air conditioning'],
    overview:
      'A plant-filled ceramics studio with eight wheels, two large work tables and a glaze station. The space suits classes, team workshops and small production runs. Aprons, tools and a sink station are all included.',
    owner: 'host',
  },
  {
    key: 'glasshouse',
    title: 'The Glasshouse',
    category: 'Photo Studio',
    hourlyRate: 110,
    securityDeposit: 300,
    capacity: 15,
    location: 'Long Island City, Queens, NY',
    imageURL: img('1497366754035-f200968a6e72'),
    images: [
      img('1497366754035-f200968a6e72'),
      img('1600607687939-ce8a6c25118c'),
      img('1616486338812-3dadae4b4ace'),
    ],
    amenities: ['Natural light', 'Blackout curtains', 'Lighting kit', 'Makeup room', 'Freight access'],
    overview:
      'A corner studio wrapped in glass with a skyline view and full blackout control. Comes with Profoto strobes, a 9-foot seamless setup and a private hair and makeup room. Popular for campaign portraits and lookbooks.',
    owner: 'host',
  },
  {
    key: 'rooftop',
    title: 'Rooftop Assembly',
    category: 'Event Space',
    hourlyRate: 180,
    securityDeposit: 600,
    capacity: 80,
    location: 'DUMBO, Brooklyn, NY',
    imageURL: img('1531058020387-3be344556be6'),
    images: [
      img('1531058020387-3be344556be6'),
      img('1515187029135-18ee286d815b'),
      img('1524368535928-5b5e00ddc76b'),
    ],
    amenities: ['Seating lounge', 'Wi-Fi', 'Kitchenette', 'Air conditioning', 'Parking'],
    overview:
      'An open-air rooftop with bridge views, built-in bench seating and a small catering kitchen. It works equally well for product launches, wrap parties and editorial events. A rain plan with an adjoining indoor room is included.',
    owner: 'host',
  },
  {
    key: 'basement',
    title: 'Basement Rehearsal Lab',
    category: 'Music Suite',
    hourlyRate: 45,
    securityDeposit: 80,
    capacity: 8,
    location: 'Bushwick, Brooklyn, NY',
    imageURL: img('1519892300165-cb5542fb47c7'),
    images: [
      img('1519892300165-cb5542fb47c7'),
      img('1511379938547-c1f69419868d'),
      img('1571330735066-03aaa9429d89'),
    ],
    amenities: ['Instruments', 'Pro audio', 'Air conditioning', 'Wi-Fi'],
    overview:
      'A no-frills rehearsal room with a full backline, PA and enough space for a five-piece band. Drum shells, amps and a vocal PA are set up and ready. Load-in is through a wide side entrance with two short steps.',
    owner: 'host',
  },
  {
    key: 'northlight',
    title: 'Northlight Portrait Studio',
    category: 'Photo Studio',
    hourlyRate: 95,
    securityDeposit: 250,
    capacity: 8,
    location: 'Fort Greene, Brooklyn, NY',
    imageURL: img('1519710164239-da123dc03ef4'),
    images: [
      img('1519710164239-da123dc03ef4'),
      img('1452587925148-ce544e77e70d'),
      img('1497366216548-37526070297c'),
    ],
    amenities: ['Natural light', 'Backdrops', 'Lighting kit', 'Makeup room', 'Wi-Fi'],
    overview:
      'A calm portrait studio with north-facing light, four seamless paper colours and a compact styling area. Ideal for headshots, family sessions and small editorial teams. The host keeps a steamer and lint roller on site.',
    owner: 'examiner',
  },
  {
    key: 'framegrain',
    title: 'Frame & Grain Workshop',
    category: 'Art Workshop',
    hourlyRate: 50,
    securityDeposit: 100,
    capacity: 12,
    location: 'Jersey City, NJ',
    imageURL: img('1524178232363-1fb2b075b655'),
    images: [
      img('1524178232363-1fb2b075b655'),
      img('1522202176988-66273c2fd55f'),
      img('1547891654-e66ed7ebb968'),
    ],
    amenities: ['Seating lounge', 'Wi-Fi', 'Kitchenette', 'Natural light', 'Parking'],
    overview:
      'A bright maker space with long communal tables, a printing station and a small kitchen. Set up for photography workshops, zine making and creative team sessions. Materials storage and a rolling cart are included.',
    owner: 'examiner',
  },
  {
    key: 'listening',
    title: 'The Listening Booth',
    category: 'Podcast Room',
    hourlyRate: 65,
    securityDeposit: 100,
    capacity: 3,
    location: 'Lower East Side, Manhattan, NY',
    imageURL: img('1478737270239-2f02b77fc618'),
    images: [
      img('1478737270239-2f02b77fc618'),
      img('1590602847861-f357a9332bbc'),
      img('1598488035139-bdbb2231ce04'),
    ],
    amenities: ['Pro audio', 'Microphones', 'Wi-Fi', 'Air conditioning'],
    overview:
      'An intimate two-person booth with broadcast-grade mics, a boom arm and a clean feed ready for Riverside or Zoom. The room is tuned for voice and stays pin-drop quiet. Best for solo shows and tight interview setups.',
    owner: 'examiner',
  },
  {
    key: 'atlas',
    title: 'Atlas Film Stage',
    category: 'Sound Stage',
    hourlyRate: 160,
    securityDeposit: 750,
    capacity: 50,
    location: 'Astoria, Queens, NY',
    imageURL: img('1485846234645-a62644f84728'),
    images: [
      img('1485846234645-a62644f84728'),
      img('1497366811353-6870744d04b2'),
      img('1542204165-65bf26472b9b'),
    ],
    amenities: [
      'Green screen',
      'Cyc wall',
      'Freight access',
      'Lighting kit',
      'Parking',
      'Loading dock',
    ],
    overview:
      'A purpose-built film stage with a 24-foot cyc, grid-mounted lighting and a separate wardrobe room. The drive-in door takes a full grip truck, and a kitchenette keeps the crew fed. Weekly production rates are available.',
    owner: 'leo',
  },
  {
    key: 'maple',
    title: 'Maple Street Music Room',
    category: 'Music Suite',
    hourlyRate: 70,
    securityDeposit: 150,
    capacity: 5,
    location: 'Park Slope, Brooklyn, NY',
    imageURL: img('1511379938547-c1f69419868d'),
    images: [
      img('1511379938547-c1f69419868d'),
      img('1598488035139-bdbb2231ce04'),
      img('1571330735066-03aaa9429d89'),
    ],
    amenities: ['Mixing console', 'Instruments', 'Pro audio', 'Kitchenette'],
    overview:
      'A brownstone music room with a upright piano, warm acoustics and a simple tracking setup. Great for songwriting sessions, strings and voiceover. The host leaves tea and coffee stocked for longer bookings.',
    owner: 'leo',
  },
  {
    key: 'paperpigment',
    title: 'Paper & Pigment Studio',
    category: 'Art Workshop',
    hourlyRate: 55,
    securityDeposit: 90,
    capacity: 14,
    location: 'Harlem, Manhattan, NY',
    imageURL: img('1460661419201-fd4cecdf8a8b'),
    images: [
      img('1460661419201-fd4cecdf8a8b'),
      img('1513364776144-60967b0f800f'),
      img('1547891654-e66ed7ebb968'),
    ],
    amenities: ['Natural light', 'Seating lounge', 'Wi-Fi', 'Kitchenette'],
    overview:
      'A generous art room with easels, drying racks and north light all afternoon. The layout flexes between life drawing, painting classes and small exhibitions. Drop cloths and a utility sink are part of the setup.',
    owner: 'leo',
  },
];

const commentPools = {
  'Photo Studio': [
    'The cyc wall was spotless and the natural light did half the work for us.',
    'Loaded in at 8am with no fuss — the space matched the photos exactly.',
    'Great styling corner, and the host had stands ready when we arrived.',
  ],
  'Sound Stage': [
    'Acoustics were excellent and the loading dock saved our crew a full hour.',
    'Plenty of power, solid rigging points and a host who actually knows production.',
    'We shot two setups in one day without ever feeling cramped.',
  ],
  'Podcast Room': [
    'Quiet, warm, and the mics were already patched when we walked in.',
    'Booked two hours and left with a full episode — zero background noise.',
    'The lounge made our guests feel comfortable before recording even started.',
  ],
  'Music Suite': [
    'The console sounded incredible and the room is tuned beautifully.',
    'Great backline and a relaxed vibe — we tracked four songs in a day.',
    'The host was flexible with load-in and the monitoring setup was perfect.',
  ],
  'Art Workshop': [
    'Tables, light and ventilation were exactly right for a full-day class.',
    'Our group of ten had room to spread out and the sink station was a lifesaver.',
    'A calm, inspiring space — the students did not want to leave.',
  ],
  'Event Space': [
    'The room transformed beautifully for our launch and the team was helpful.',
    'Great flow between the lounge and the main floor, with easy load-in.',
    'Our guests loved the space; the skyline view did the rest.',
  ],
};

const ratingPlan = [
  [5, 5, 5],
  [5, 5, 4],
  [5, 4, 4],
  [5, 5, 4],
  [5, 4, 4],
  [5, 5, 5],
  [4, 5, 4],
  [4, 5, 5],
  [5, 5, 5],
  [5, 5, 4],
  [5, 4, 5],
  [5, 5, 5],
  [5, 4, 5],
  [4, 5, 5],
];

const bookingsSeed = [
  {
    studioKey: 'daylight',
    guestKey: 'examiner',
    days: 10,
    startTime: '10:00',
    endTime: '14:00',
    status: 'Confirmed',
    note: 'Editorial shoot — bringing one assistant and a rolling rack.',
  },
  {
    studioKey: 'quietroom',
    guestKey: 'examiner',
    days: 6,
    startTime: '09:00',
    endTime: '12:00',
    status: 'Pending',
    note: 'Two-guest interview, remote co-host joining on Zoom.',
  },
  {
    studioKey: 'amber',
    guestKey: 'examiner',
    days: -25,
    startTime: '13:00',
    endTime: '17:00',
    status: 'Completed',
    note: 'Vocal tracking for a four-song EP.',
  },
  {
    studioKey: 'sunroom',
    guestKey: 'examiner',
    days: 4,
    startTime: '15:00',
    endTime: '18:00',
    status: 'Cancelled',
    note: 'Rescheduled after a schedule clash.',
  },
  {
    studioKey: 'northlight',
    guestKey: 'jordan',
    days: 8,
    startTime: '10:00',
    endTime: '14:00',
    status: 'Confirmed',
    note: 'Brand headshots for a small agency team.',
  },
  {
    studioKey: 'northlight',
    guestKey: 'priya',
    days: 8,
    startTime: '12:00',
    endTime: '16:00',
    status: 'Pending',
    note: 'Portrait session — request overlaps the confirmed booking on purpose.',
  },
  {
    studioKey: 'listening',
    guestKey: 'noah',
    days: 5,
    startTime: '11:00',
    endTime: '13:00',
    status: 'Pending',
    note: 'Solo podcast recording, two episodes back to back.',
  },
];

const computeTotals = (studio, startTime, endTime) => {
  const hours = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
  const subtotal = roundMoney(studio.hourlyRate * hours);
  const serviceFee = roundMoney(subtotal * 0.05);
  return { hours, subtotal, serviceFee, total: roundMoney(subtotal + serviceFee) };
};

/**
 * Seeds a complete demo dataset. Safe to run repeatedly with `reset: true`
 * from `npm run seed`, or automatically when the database is empty.
 */
export const seedDatabase = async ({ reset = false } = {}) => {
  if (reset) {
    await Promise.all([
      Booking.deleteMany({}),
      Review.deleteMany({}),
      Wishlist.deleteMany({}),
      Studio.deleteMany({}),
      User.deleteMany({}),
    ]);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const userDocs = {};
  for (const person of people) {
    const user =
      (await User.findOne({ email: person.email })) ??
      (await User.create({
        name: person.name,
        email: person.email,
        photoURL: person.photoURL,
        passwordHash,
        provider: 'credentials',
      }));
    userDocs[person.key] = user;
  }

  const studioDocs = {};
  for (const [index, data] of studios.entries()) {
    const owner = byKey[data.owner];
    const studio = await Studio.create({
      title: data.title,
      category: data.category,
      hourlyRate: data.hourlyRate,
      securityDeposit: data.securityDeposit,
      capacity: data.capacity,
      location: data.location,
      imageURL: data.imageURL,
      images: data.images,
      amenities: data.amenities,
      overview: data.overview,
      ownerEmail: owner.email,
      ownerName: owner.name,
      ownerPhoto: owner.photoURL,
    });
    studioDocs[data.key] = studio;

    const reviewerKeys = ['jordan', 'priya', 'noah', 'examiner'].filter(
      (key) => byKey[key].email !== owner.email,
    );
    const chosen = reviewerKeys.slice(0, 3);
    const pool = commentPools[data.category] || commentPools['Photo Studio'];
    const ratings = ratingPlan[index % ratingPlan.length];
    const ratingValues = [];

    for (const [reviewIndex, reviewerKey] of chosen.entries()) {
      const reviewer = byKey[reviewerKey];
      const rating = ratings[(index + reviewIndex) % ratings.length];
      ratingValues.push(rating);

      await Review.create({
        studioId: studio._id,
        userEmail: reviewer.email,
        userName: reviewer.name,
        userPhoto: reviewer.photoURL,
        rating,
        comment: pool[(index + reviewIndex) % pool.length],
      });
    }

    const average = ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length;
    studio.rating = Math.round(average * 10) / 10;
    studio.reviewCount = ratingValues.length;
    await studio.save();
  }

  const bookingDocs = [];
  for (const data of bookingsSeed) {
    const studio = studioDocs[data.studioKey];
    const guest = byKey[data.guestKey];
    const totals = computeTotals(studio, data.startTime, data.endTime);
    const owner = people.find((person) => person.email === studio.ownerEmail);

    const booking = await Booking.create({
      studioId: studio._id,
      studioSnapshot: {
        title: studio.title,
        imageURL: studio.imageURL,
        category: studio.category,
        location: studio.location,
      },
      userEmail: guest.email,
      userName: guest.name,
      ownerEmail: studio.ownerEmail,
      date: dateFromNow(data.days),
      startTime: data.startTime,
      endTime: data.endTime,
      hours: totals.hours,
      hourlyRate: studio.hourlyRate,
      subtotal: totals.subtotal,
      serviceFee: totals.serviceFee,
      securityDeposit: studio.securityDeposit,
      total: totals.total,
      note: data.note,
      status: data.status,
      cancelledAt: data.status === 'Cancelled' ? new Date() : null,
    });
    bookingDocs.push({ booking, owner: owner?.name });
  }

  // A couple of saved studios for the examiner account's wishlist page.
  const examiner = byKey.examiner;
  for (const key of ['glasshouse', 'sunroom', 'atlas']) {
    await Wishlist.create({ userEmail: examiner.email, studioId: studioDocs[key]._id });
  }

  return {
    users: people.length,
    studios: studios.length,
    reviews: studios.length * 3,
    bookings: bookingDocs.length,
    credentials: {
      examiner: 'examiner@studiosspace.com / Studio123',
      host: 'host@studiosspace.com / Studio123',
    },
  };
};

/** Seeds only when the database is empty — used on first boot. */
export const ensureSeeded = async () => {
  const [studioCount, userCount] = await Promise.all([
    Studio.countDocuments(),
    User.countDocuments(),
  ]);

  if (studioCount === 0 && userCount === 0) {
    console.log('[seed] Empty database detected — creating StudioSpace demo data…');
    const result = await seedDatabase();
    console.log(
      `[seed] Ready: ${result.studios} studios, ${result.reviews} reviews, ${result.bookings} bookings.`,
    );
    console.log('[seed] Examiner login: examiner@studiosspace.com / Studio123');
    return result;
  }

  return null;
};
