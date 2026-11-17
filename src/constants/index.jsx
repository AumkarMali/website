import { BotMessageSquare } from "lucide-react";
import { BatteryCharging } from "lucide-react";
import { Fingerprint } from "lucide-react";
import { ShieldHalf } from "lucide-react";
import { PlugZap } from "lucide-react";
import { GlobeLock } from "lucide-react";


export const navItems = [
  { label: "Links", href: "start" },
  { label: "About Me", href: "aboutSec" },
  { label: "Career", href: "career" },
  { label: "Technical Skills", href: "feature-section" },
  { label: "Project Timeline", href: "pr" },
  { label: "Expertise", href: "expertise" },
  { label: "Socials", href: "socials" },
];

export const LINKEDIN_URL = "https://www.linkedin.com/in/aum-mali-976b7b392/";
export const EMAIL = "aumkarmali539@gmail.com";

// From LinkedIn. start/end are [year, month]; end: null means present.
export const career = [
  {
    role: "Embedded Software Engineer Intern",
    company: "Tesla",
    type: "Internship",
    start: [2026, 9],
    end: null,
    location: "Palo Alto, California, United States",
    mode: "On-site",
    skills: ["Embedded Software", "C", "CAN", "HIL / SIL"],
    summary: "SIL and HIL test harnesses and CAN debugging for vehicle ECUs.",
    logo: { src: "/images/logos/tesla.svg", tile: "bg-white p-2" },
  },
  {
    role: "AI Software Engineering Intern",
    company: "Sapien",
    type: "Internship",
    start: [2026, 8],
    end: [2026, 8],
    location: "Toronto, Ontario, Canada",
    mode: "Remote",
    skills: ["Claude Code", "Rust", "React"],
    summary: "LLM evaluation tooling: hallucination and drift scoring with a Rust API and React review UI.",
    logo: { src: "/images/logos/sapien.png", tile: "p-0" },
  },
  {
    role: "DSP Firmware Engineer Intern",
    company: "Nokia",
    type: "Internship",
    start: [2026, 1],
    end: [2026, 4],
    location: "Ottawa, Ontario, Canada",
    mode: "On-site",
    skills: ["Electrical Engineering", "C++"],
    logo: { src: "/images/logos/nokia.svg", tile: "bg-white p-1.5" },
  },
  {
    role: "Undergraduate Research Assistant - Autonomous Vehicles",
    company: "University of Waterloo",
    type: "Apprenticeship",
    start: [2025, 9],
    end: [2025, 11],
    location: "Waterloo, Ontario, Canada",
    mode: "On-site",
    skills: ["ROS", "C++"],
    logo: { src: "/images/logos/uwaterloo.svg", tile: "bg-white p-1.5" },
  },
  {
    role: "Firmware Developer",
    company: "Midnight Sun Solar Rayce Car Team",
    type: "On-Call",
    start: [2024, 10],
    end: [2025, 9],
    location: "Waterloo, Ontario, Canada",
    mode: "On-site",
    skills: ["Firmware", "Embedded Devices"],
    logo: { src: "/images/logos/midnightsun.png", tile: "p-0" },
  },
  {
    role: "Machine Vision Co-op",
    company: "Taymer International Inc.",
    type: "Co-op",
    start: [2025, 5],
    end: [2025, 8],
    location: "Markham, Ontario, Canada",
    mode: "On-site",
    skills: ["Computer Vision", "Python", "CUDA", "TensorRT"],
    summary: "GPU point-cloud defect detection (33x faster) and a PointNet++ model deployed with TensorRT.",
    logo: { src: "/images/logos/taymer.png", tile: "bg-white p-1.5" },
  },
  {
    role: "Founder and Tutor",
    company: "STEM Scholars Tutors",
    type: "Self-employed",
    start: [2022, 4],
    end: [2024, 11],
    location: "Mississauga, Ontario, Canada",
    skills: ["Web Development", "Tutoring"],
    logo: { src: "/images/logos/stemscholars.png", tile: "bg-white p-0" },
  },
  {
    role: "Robotics YouTube",
    company: "YouTube Channel",
    type: "Self-employed",
    start: [2018, 2],
    end: [2024, 7],
    skills: ["Robotics", "Content Creation"],
    logo: { src: "/images/logos/youtube.svg", tile: "bg-white p-2" },
  },
];



export const features = [
  {
    icon: <BotMessageSquare />,
    text: "Drag-and-Drop Interface",
    description:
      "Easily design and arrange your VR environments with a user-friendly drag-and-drop interface.",
  },
  {
    icon: <Fingerprint />,
    text: "Multi-Platform Compatibility",
    description:
      "Build VR applications that run seamlessly across multiple platforms, including mobile, desktop, and VR headsets.",
  },
  {
    icon: <ShieldHalf />,
    text: "Built-in Templates",
    description:
      "Jumpstart your VR projects with a variety of built-in templates for different types of applications and environments.",
  },
  {
    icon: <BatteryCharging />,
    text: "Real-Time Preview",
    description:
      "Preview your VR application in real-time as you make changes, allowing for quick iterations and adjustments.",
  },
  {
    icon: <PlugZap />,
    text: "Collaboration Tools",
    description:
      "Work together with your team in real-time on VR projects, enabling seamless collaboration and idea sharing.",
  },
  {
    icon: <GlobeLock />,
    text: "Analytics Dashboard",
    description:
      "Gain valuable insights into user interactions and behavior within your VR applications with an integrated analytics dashboard.",
  },
];

export const checklistItems = [
  {
    title: "Code merge made easy",
    description:
      "Track the performance of your VR apps and gain insights into user behavior.",
  },
  {
    title: "Review code without worry",
    description:
      "Track the performance of your VR apps and gain insights into user behavior.",
  },
  {
    title: "AI Assistance to reduce time",
    description:
      "Track the performance of your VR apps and gain insights into user behavior.",
  },
  {
    title: "Share work in minutes",
    description:
      "Track the performance of your VR apps and gain insights into user behavior.",
  },
];


// Radar chart: median of three independent scorings of both resumes (0-100).
export const expertise = [
  { axis: "Firmware & Embedded", short: "Firmware", score: 85, evidence: "Embedded C on Tesla vehicle ECUs and CAN; DSP firmware at Nokia (15% lower latency); STM32 firmware at Midnight Sun." },
  { axis: "Testing & Validation", short: "SIL / HIL testing", score: 76, evidence: "Pytest SIL and HIL harnesses that reproduce ECU defects at Tesla; HIL test framework with 90% coverage at Midnight Sun." },
  { axis: "Robotics & Autonomy", short: "Robotics", score: 74, evidence: "ROS2 swarm flight for 30+ Crazyflie drones at UWaterloo CL2; MedicArm 5-axis arm (1st place, UTRA)." },
  { axis: "AI / ML", short: "AI / ML", score: 75, evidence: "LLM evaluation at Sapien; PointNet++ segmentation at Taymer; MV-HST transformer (1st place, Shazam for Drones)." },
  { axis: "Computer Vision & GPU", short: "Vision & GPU", score: 72, evidence: "Custom CUDA kernels for a 33x faster point-cloud pipeline and TensorRT deployment at Taymer." },
  { axis: "Full-Stack Web", short: "Full-stack", score: 65, evidence: "React client and Rust API at Sapien; EmberEye (React, Flask, MongoDB, Vercel) and BehaViewer." },
];
