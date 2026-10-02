import { useEffect, useState } from 'react'
import './App.css'
import { MdOutlineTravelExplore } from 'react-icons/md'
import { IoClose, IoSend } from 'react-icons/io5'
import { TbGridDots } from 'react-icons/tb'
import { CiLocationOn } from 'react-icons/ci'
import {
  FaCalendarAlt,
  FaClipboardList,
  FaFilter,
  FaTwitter,
  FaYoutube,
  FaInstagram,
  FaTripadvisor,
  FaChevronRight,
} from 'react-icons/fa'
import AOS from 'aos'
import 'aos/dist/aos.css'
import video from './assets/video.mp4'
import img1 from './assets/imageVideo/image1.jpeg'
import img2 from './assets/imageVideo/image2.jpeg'
import img3 from './assets/imageVideo/image3.jpeg'
import img4 from './assets/imageVideo/image4.jpeg'
import img5 from './assets/imageVideo/image5.jpeg'
import img6 from './assets/imageVideo/image6.jpeg'
import img7 from './assets/imageVideo/image7.jpeg'
import img8 from './assets/imageVideo/image8.jpeg'
import img9 from './assets/imageVideo/image9.jpeg'

const destinations = [
  { id: 1, imgSrc: img1, destTitle: 'Amboseli National Park', location: 'Kenya', grade: 'CULTURAL RELAX', fees: 'Ksh. 200,000', description: 'Experience the iconic sights of elephants and Mount Kilimanjaro in one unforgettable safari.' },
  { id: 2, imgSrc: img2, destTitle: 'Maasai Mara National Reserve', location: 'Kenya', grade: 'CHILL ADVENTURE', fees: 'Ksh. 300,000', description: 'Discover extraordinary wildlife and breathtaking landscapes during the Great Migration season.' },
  { id: 3, imgSrc: img3, destTitle: 'Diani Beach', location: 'Kenya', grade: 'BEACH RELAX', fees: 'Ksh. 150,000', description: 'Relax on golden sand, swim in turquoise waters, and enjoy world-class coastal experiences.' },
  { id: 4, imgSrc: img4, destTitle: 'Lamu Island', location: 'Kenya', grade: 'SERENITY', fees: 'Ksh. 250,000', description: 'Wander through historic streets and enjoy an island atmosphere filled with culture and calm.' },
  { id: 5, imgSrc: img5, destTitle: 'Lake Nakuru', location: 'Kenya', grade: 'WILDLIFE', fees: 'Ksh. 180,000', description: 'Watch flamingos and rhinos in a peaceful landscape surrounded by dramatic views.' },
  { id: 6, imgSrc: img6, destTitle: 'Tsavo East', location: 'Kenya', grade: 'ADVENTURE', fees: 'Ksh. 220,000', description: 'Explore open savannahs, dramatic plains, and unforgettable game-drive moments.' },
  { id: 7, imgSrc: img7, destTitle: 'Nairobi City', location: 'Kenya', grade: 'URBAN VIBES', fees: 'Ksh. 120,000', description: 'Blend city energy, culture, and iconic attractions in Kenya’s thriving capital.' },
  { id: 8, imgSrc: img8, destTitle: 'Naivasha', location: 'Kenya', grade: 'LAKE LIFE', fees: 'Ksh. 160,000', description: 'Enjoy lake views, nature trails, and a relaxed getaway under big skies.' },
  { id: 9, imgSrc: img9, destTitle: 'Mombasa Coast', location: 'Kenya', grade: 'COASTAL ESCAPE', fees: 'Ksh. 170,000', description: 'Experience culture, seafood, and a breathtaking coastline with easy island vibes.' },
]

function App() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [selectedDestination, setSelectedDestination] = useState(destinations[0])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [checkoutRequestId, setCheckoutRequestId] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState('')
  const [bookingNotice, setBookingNotice] = useState('')

  const handleOpenDetails = (destination) => {
    setSelectedDestination(destination)
    setIsDetailsOpen(true)
    setIsPaymentOpen(false)
  }

  const handleOpenPayment = (destination = selectedDestination) => {
    setSelectedDestination(destination)
    setPaymentStatus('')
    setPhoneNumber('')
    setIsSubmittingPayment(false)
    setCheckoutRequestId('')
    setIsDetailsOpen(false)
    setIsPaymentOpen(true)
  }

  const handlePaymentSubmit = async (event) => {
    event.preventDefault()
    setIsSubmittingPayment(true)
    setPaymentStatus('Sending an M-Pesa payment prompt to your phone...')

    try {
      const response = await fetch('/api/payments/stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId: selectedDestination.id, phoneNumber }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Unable to start M-Pesa payment.')

      setCheckoutRequestId(result.checkoutRequestId)
      setPaymentStatus(result.customerMessage || 'Check your phone and enter your M-Pesa PIN to approve the payment.')
    } catch (error) {
      setPaymentStatus(error.message || 'Could not connect to the payment service. Please try again.')
      setIsSubmittingPayment(false)
    }
  }

  useEffect(() => {
    if (!checkoutRequestId) return undefined

    let active = true
    let attempts = 0

    const checkPaymentStatus = async () => {
      attempts += 1

      try {
        const response = await fetch(`/api/payments/status/${encodeURIComponent(checkoutRequestId)}`)
        const result = await response.json()
        if (!active) return

        if (result.status === 'succeeded') {
          const amount = new Intl.NumberFormat('en-KE', {
            style: 'currency', currency: 'KES', maximumFractionDigits: 0,
          }).format(result.amount)
          setPaymentStatus(`Payment confirmed. Receipt: ${result.receiptNumber || 'received'}.`)
          setBookingNotice(`Payment confirmed for ${selectedDestination.destTitle}. Your booking total is ${amount}.`)
          setIsSubmittingPayment(false)
          setCheckoutRequestId('')
          return
        }

        if (result.status === 'failed') {
          setPaymentStatus(result.message || 'M-Pesa payment was not completed. Please try again.')
          setIsSubmittingPayment(false)
          setCheckoutRequestId('')
          return
        }
      } catch {
        if (!active) return
      }

      if (active && attempts >= 40) {
        setPaymentStatus('Still waiting for M-Pesa. Check your phone; the provider may take longer to send its confirmation.')
        setIsSubmittingPayment(false)
        setCheckoutRequestId('')
      }
    }

    checkPaymentStatus()
    const timer = window.setInterval(checkPaymentStatus, 3000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [checkoutRequestId, selectedDestination.destTitle])

  const handleNewsletterSubmit = (event) => {
    event.preventDefault()
    if (!newsletterEmail.trim()) {
      setNewsletterStatus('Please enter your email address to receive travel updates.')
      return
    }
    setNewsletterStatus(`Thank you! We’ll send your itinerary updates to ${newsletterEmail}.`)
    setNewsletterEmail('')
  }

  useEffect(() => {
    AOS.init({ duration: 2000, once: true })
  }, [])

  return (
    <>
      <section className="navBarSection">
        <header className="header flex">
          <div className="logoDiv"><a href="#" className="logo"><h1><MdOutlineTravelExplore className="icon" />Travel</h1></a></div>
          <div className={isNavOpen ? 'navBar activeNavbar' : 'navBar'}>
            <ul className="navLists flex">
              <li className="navItem"><a href="#" className="navLink">Home</a></li>
              <li className="navItem"><a href="#packages" className="navLink">Packages</a></li>
              <li className="navItem"><a href="#packages" className="navLink">Shop</a></li>
              <li className="navItem"><a href="#contact" className="navLink">About</a></li>
              <li className="navItem"><a href="#packages" className="navLink">Pages</a></li>
              <li className="navItem"><a href="#contact" className="navLink">News</a></li>
              <li className="navItem"><a href="#contact" className="navLink">Contact</a></li>
              <button className="btn" type="button" onClick={() => handleOpenPayment(destinations[0])}>Book Now</button>
            </ul>
            <button aria-label="Close menu" onClick={() => setIsNavOpen(false)} className="closeNavbar" type="button"><IoClose /></button>
          </div>
          <button aria-label="Open menu" onClick={() => setIsNavOpen((open) => !open)} className="toggleNavbar icon" type="button"><TbGridDots /></button>
        </header>
      </section>

      <section className="home">
        <div className="overlay" />
        <video src={video} autoPlay loop muted />
        <div className="home-contents"><div className="textDiv"><span data-aos="fade-up" className="smallText">Our packages</span><h1 data-aos="fade-up" className="home-title">Search your holiday</h1></div></div>
        <div data-aos="fade-up" className="cardDiv grid">
          <div className="destinationInput cardItem"><label htmlFor="city">Search your destination:</label><div className="input flex"><input id="city" type="text" placeholder="Enter name here..." /><CiLocationOn className="icon" /></div></div>
          <div className="dateInput cardItem"><label htmlFor="date">Search your dates:</label><div className="input flex"><input id="date" type="date" /><FaCalendarAlt /></div></div>
          <div className="priceInput cardItem"><div className="label_total"><label htmlFor="price">Max price:</label><h3 className="total">Ksh.500,000</h3></div><div className="input flex"><input id="price" type="range" max="500000" min="2000" step="1000" defaultValue="500000" /></div></div>
          <div className="searchOptions flex" onClick={() => handleOpenPayment(destinations[0])}><FaFilter className="icon" /><span>More Filters</span></div>
        </div>
      </section>

      {bookingNotice && <div className="bookingNotice">{bookingNotice}</div>}

      <section id="packages" className="main-container section">
        <div className="sectitle"><h3 className="title">Most visited destinations</h3></div>
        <div data-aos="fade-up" className="secContent grid">
          {destinations.map((destination) => (
            <div key={destination.id} className="singleDestination">
              <div className="imageDiv"><img src={destination.imgSrc} alt={destination.destTitle} /></div>
              <div className="cardInfo">
                <h4 className="destTitle">{destination.destTitle}</h4>
                <span className="continent flex"><CiLocationOn className="icon" /><span className="name">{destination.location}</span></span>
                <div className="fees flex"><div className="grade"><span>{destination.grade}<small> +1</small></span></div><div className="price"><h5>{destination.fees}</h5></div></div>
                <p className="description">{destination.description}</p>
                <button className="btn flex" type="button" onClick={() => handleOpenDetails(destination)}><span>DETAILS</span><FaClipboardList className="icon" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="footer">
        <div className="videoDiv"><video src={video} autoPlay loop muted type="video/mp4" /></div>
        <div className="secContent container">
          <div className="contactDiv flex"><div className="text"><small data-aos="fade-up">KEEP IN TOUCH</small><h1 data-aos="fade-up">Travel with number one travel tours Safaris</h1></div></div>
          <form className="inputDiv flex" onSubmit={handleNewsletterSubmit}>
            <input data-aos="fade-up" type="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="Enter Email Address" />
            <button data-aos="fade-up" className="btn flex" type="submit">SEND <IoSend /></button>
          </form>
          {newsletterStatus && <div className="newsletterStatus">{newsletterStatus}</div>}
          <div className="footerCard">
            <div className="footerIntro"><div className="footerparagraph"><p data-aos="fade-up" className="footerText">Travel safaris is one of the leading travel companies in the industry, offering exceptional experiences and unforgettable memories.</p></div><div className="footerSocials"><FaTwitter /><FaYoutube /><FaInstagram /><FaTripadvisor /></div></div>
            <div className="footerlinks"><div className="linkGroup"><span className="groupTitle">OUR AGENCY</span>{['Services', 'Agency', 'Insurance', 'Tourism', 'Payment'].map((item) => <li key={item} className="footerLists"><FaChevronRight className="icon" />{item}</li>)}</div></div>
            <div className="footerlinks"><div className="linkGroup"><span className="groupTitle">PARTNERS</span>{['Bookings', 'Rentcars', 'HostelWorld', 'Trivago', 'TripAdvisor'].map((item) => <li key={item} className="footerLists"><FaChevronRight className="icon" />{item}</li>)}</div></div>
            <div className="footerlinks"><div className="linkGroup"><span className="groupTitle">LAST MINUTE</span>{['Laikipia', 'Nyeri', 'Thika', 'Kisumu', 'Eldoret'].map((item) => <li key={item} className="footerLists"><FaChevronRight className="icon" />{item}</li>)}</div></div>
          </div>
          <div className="footerDiv flex"><small>BEST TRAVEL WEBSITE THEME</small><small>COPYRIGHTS RESERVED - TRAVEL SAFARIS</small></div>
        </div>
      </section>

      {isDetailsOpen && (
        <div className="modalOverlay" onClick={() => setIsDetailsOpen(false)}>
          <div className="modalCard" onClick={(event) => event.stopPropagation()}>
            <div className="modalHeader"><h3>{selectedDestination.destTitle}</h3><button type="button" className="closeModal" onClick={() => setIsDetailsOpen(false)}>×</button></div>
            <div className="detailImageWrapper"><img src={selectedDestination.imgSrc} alt={selectedDestination.destTitle} /></div>
            <div className="detailMeta"><span className="detailBadge">{selectedDestination.location}</span><span className="detailBadge">{selectedDestination.grade}</span></div>
            <p className="detailDescription">{selectedDestination.description}</p>
            <div className="modalFooterLine"><strong>{selectedDestination.fees}</strong><button className="btn modalAction" type="button" onClick={() => handleOpenPayment(selectedDestination)}>Book now</button></div>
          </div>
        </div>
      )}

      {isPaymentOpen && (
        <div className="modalOverlay" onClick={() => setIsPaymentOpen(false)}>
          <div className="modalCard paymentCard" onClick={(event) => event.stopPropagation()}>
            <div className="modalHeader"><h3>M-Pesa checkout</h3><button type="button" className="closeModal" onClick={() => setIsPaymentOpen(false)}>×</button></div>
            <div className="paymentSummary"><span>{selectedDestination.destTitle}</span><strong>{selectedDestination.fees}</strong></div>
            <form className="paymentForm" onSubmit={handlePaymentSubmit}>
              <label htmlFor="mpesa-phone">M-Pesa phone number
                <input id="mpesa-phone" type="tel" name="phoneNumber" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="07XX XXX XXX or 2547XXXXXXXX" autoComplete="tel" required />
              </label>
              <p className="paymentHint">We’ll send an STK Push prompt to your phone. Enter your M-Pesa PIN to approve the payment.</p>
              {paymentStatus && <p className="paymentStatus" role="status">{paymentStatus}</p>}
              <button className="btn paymentSubmit" type="submit" disabled={isSubmittingPayment}>{isSubmittingPayment ? 'Waiting for M-Pesa...' : 'Send payment prompt'}</button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default App
