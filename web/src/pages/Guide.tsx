import { useAuth } from '../lib/auth';

/** Built-in user guide. Written in the simplest possible language on purpose. */

function Section({ icon, title, children, open }: { icon: string; title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="card group" open={open}>
      <summary className="p-4 cursor-pointer select-none flex items-center gap-3 font-bold text-slate-100 list-none [&::-webkit-details-marker]:hidden">
        <span className="text-2xl">{icon}</span>
        <span className="flex-1">{title}</span>
        <span className="text-slate-500 group-open:rotate-90 transition">▶</span>
      </summary>
      <div className="px-5 pb-5 space-y-3 text-slate-300 text-[15px] leading-relaxed">{children}</div>
    </details>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">{n}</span>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <span className="font-bold text-brand-300">{children}</span>;
const Gold = ({ children }: { children: React.ReactNode }) => <span className="font-bold text-gold-400">{children}</span>;

export default function Guide() {
  const { can } = useAuth();

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">📖 User Guide</h1>
        <p className="text-slate-400 text-sm mt-1">Everything in this app, explained the easy way. Tap any box to open it.</p>
      </div>

      <Section icon="🤔" title="What is this app?" open>
        <p>
          This app is like a <B>stopwatch for work</B>. When you install devices or pull cable, the app times how long it
          takes. Then it remembers everything — forever.
        </p>
        <p>
          Why? Because when the company knows how long work <i>really</i> takes, it can plan better jobs, send the right
          number of people, and win more work. <Gold>Every time you use it, the company gets smarter.</Gold>
        </p>
        <p>It is <B>not</B> a timecard. It does not track your breaks or your day. It only times the task you tell it to time.</p>
      </Section>

      <Section icon="📱" title="Put the app on your phone">
        <Step n={1}>Open <B>3dtsi-lip.pages.dev</B> in your phone's browser (Safari on iPhone, Chrome on Android).</Step>
        <Step n={2}>
          On iPhone: tap the <B>Share</B> button (the square with the arrow), then tap <B>Add to Home Screen</B>.<br />
          On Android: tap the <B>⋮ menu</B>, then tap <B>Add to Home screen</B>.
        </Step>
        <Step n={3}>Done! Now there's a <Gold>3D LABOR</Gold> icon on your phone, just like a regular app.</Step>
      </Section>

      <Section icon="🔑" title="Make an account and sign in">
        <Step n={1}>On the sign-in screen, tap <B>Create account (3DTSI staff)</B>.</Step>
        <Step n={2}>Type your name, your <B>work email</B> (it must end with <Gold>@3dtsi.com</Gold>), and a password with at least 10 characters.</Step>
        <Step n={3}>Check your email for a <B>6-digit code</B> and type it in. That proves the email is really yours.</Step>
        <Step n={4}>Now sign in with your email and password. That's it!</Step>
        <p className="text-sm text-slate-400">
          Forgot your password? Tap <B>Forgot password?</B> on the sign-in screen and we'll email you a code to set a new one.
        </p>
      </Section>

      <Section icon="📋" title="Pick your project">
        <p>After you sign in, you'll see a list of projects (jobs).</p>
        <Step n={1}>Find your project in the list, or type part of its name in the search box.</Step>
        <Step n={2}>
          Even faster: tap <Gold>📷 Scan QR</Gold> and point your camera at the project's QR code (your PM can print one).
          The app jumps straight to the right project.
        </Step>
        <Step n={3}>Tap the project. Now you're ready to track work.</Step>
      </Section>

      <Section icon="🔧" title="Track installing devices (cameras, readers, strobes…)">
        <Step n={1}>Tap <B>Device Installation</B>.</Step>
        <Step n={2}>Pick the <B>System</B> (like Fire Alarm) and the <B>Device</B> (like Horn Strobe).</Step>
        <Step n={3}>Set how many people are working with the <B>− and +</B> buttons. If you want, pick their names too (that part is optional).</Step>
        <Step n={4}>Tap the big <Gold>▶ START</Gold> button. The timer starts running.</Step>
        <Step n={5}>Go do the work! Going to lunch or stopping for a delivery? Tap <B>❚❚ Pause</B>, then <B>▶ Resume</B> when you're back. Paused time does not count.</Step>
        <Step n={6}>All done? Tap <B>■ Stop</B> and type <B>how many devices you installed</B> (like 47). Tap Complete.</Step>
        <p>
          The app instantly shows your numbers — like how many devices per hour your crew did. <Gold>That result is saved
          forever</Gold> and helps the company estimate the next job.
        </p>
      </Section>

      <Section icon="🧵" title="Track pulling cable">
        <Step n={1}>Tap <B>Cable Installation</B>.</Step>
        <Step n={2}>Pick the <B>cable type</B> (like Cat6A).</Step>
        <Step n={3}>
          For every reel (spool) of cable you'll use, tap <B>+ Add reel</B> and type how many feet are on it when you start
          (usually 1000). You can have up to <B>30 reels</B>.
        </Step>
        <Step n={4}>Set your crew size, then tap <Gold>▶ START</Gold>.</Step>
        <Step n={5}>Pull cable! Pause for lunch if you need to.</Step>
        <Step n={6}>
          When you stop, the app asks how many feet are <B>left on each reel</B>. Look at the reel marks and type it in.
          The app does the math: started with 1000, have 420 left = <B>you pulled 580 feet</B>. No calculator needed!
        </Step>
      </Section>

      <Section icon="🚪" title="Closed the app by accident? No problem">
        <p>
          The timer lives on the server, not on your phone. If your phone dies or you close the app, <B>your timer keeps
          running</B>. Open the app again, go to <B>⏱️ My Work</B>, and tap your session to get right back to it.
        </p>
      </Section>

      <Section icon="⏱️" title="See your work history">
        <p>
          Tap <B>My Work</B> in the menu. The top shows anything still running. Below that is everything you've finished —
          with your speed numbers for each one. Try to beat your best!
        </p>
      </Section>

      <Section icon="🔒" title="Keep your account safe">
        <p>Tap <B>your name</B> (bottom of the menu on a computer, top right on a phone) to open your account page. There you can:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li><B>Change your password</B> — type your old one, then the new one.</li>
          <li><B>Turn on MFA</B> — scan a QR code with an authenticator app. After that, signing in also asks for a 6-digit code from your phone. It's like a second lock on your door.</li>
          <li>See every time someone signed in to your account, and from where.</li>
        </ul>
      </Section>

      {can('projects.manage') && (
        <Section icon="🗂️" title="For Project Managers: create projects">
          <p>Go to <B>Admin → Projects</B>. There are two easy ways:</p>
          <Step n={1}>
            <B>The Excel form:</B> tap <Gold>⬇ Download Project Form</Gold>, fill out the Answer column in Excel
            (project number, name, customer, systems…), save it, then tap <Gold>⬆ Upload Project</Gold> and pick your file.
            The project is created instantly with a QR code.
          </Step>
          <Step n={2}>
            <B>Type it in:</B> use the "New project" boxes on the same page.
          </Step>
          <p className="text-sm text-slate-400">
            Tip: the systems you list on the form are the only ones technicians will see on that project — fewer wrong
            choices in the field. Print the QR code (tap <B>QR</B> next to the project) and tape it up in the job trailer.
          </p>
        </Section>
      )}

      {can('dashboard.view') && (
        <Section icon="📊" title="What do the numbers mean?">
          <ul className="list-disc ml-5 space-y-2">
            <li><B>Man hours</B> = clock time × people. Two people working 3 hours = 6 man hours.</li>
            <li><B>Earned hours</B> = what the work <i>should</i> have taken according to our estimates.</li>
            <li>
              <B>Productivity</B> = earned ÷ spent. <Gold>Over 100% is winning</Gold> — the crew beat the estimate.
              Under 100% means the work took longer than planned.
            </li>
            <li><B>Confidence</B> on Intelligence pages = how much data we have. More completed sessions = more trustworthy numbers.</li>
          </ul>
        </Section>
      )}

      {can('users.manage') && (
        <Section icon="⚙️" title="For Admins: run the platform">
          <ul className="list-disc ml-5 space-y-2">
            <li><B>Admin → Users</B>: add people, disable accounts, see who has MFA on. Self-registered staff start as Technicians — promote them here.</li>
            <li><B>Admin → Roles</B>: tick or untick what each role is allowed to do.</li>
            <li><B>Admin → Catalog</B>: add new systems and devices, and set the estimate hours per unit — that number is what crews are measured against.</li>
            <li><B>Admin → Projects</B>: the 🗑 button deletes a project. If it already has recorded work, it's archived instead (hidden from the field, history kept).</li>
          </ul>
        </Section>
      )}

      <Section icon="🆘" title="Something's not working?">
        <ul className="list-disc ml-5 space-y-1">
          <li>App looks old or weird? <B>Close it all the way and open it again</B> — it updates itself.</li>
          <li>Can't sign in? Use <B>Forgot password?</B> on the sign-in screen.</li>
          <li>Camera won't scan? Just search for the project by name instead.</li>
          <li>Still stuck? Ask your PM or an admin.</li>
        </ul>
      </Section>
    </div>
  );
}
