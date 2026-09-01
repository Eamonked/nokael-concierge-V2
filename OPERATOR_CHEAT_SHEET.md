# Dashboard Operator Cheat Sheet
**Print this and keep it handy! 📋**

---

## 🚨 When to Use Emergency Controls

### ✅ USE Emergency Status Control When:
- [ ] Driver isn't answering phone
- [ ] Customer confirmed delivery by phone but didn't use the app
- [ ] System glitch prevented normal verification
- [ ] Emergency situation requires manual override

### ❌ DON'T USE It When:
- [ ] Job is proceeding normally (let the app handle it)
- [ ] You're just checking status
- [ ] Driver/customer hasn't been contacted yet
- [ ] You're unsure - ask your supervisor first!

---

## 📊 Job Status Quick Reference

| Status | What It Means | What to Do |
|--------|---------------|------------|
| **1️⃣ Pending** | Waiting for driver | Assign a driver |
| **2️⃣ Pickup** | Driver collecting from sender | Monitor, check if delayed |
| **3️⃣ In Transit** | Driver has package, delivering | Track progress |
| **4️⃣ Arrived** | Driver at recipient location | Confirm handoff soon |
| **5️⃣ Delivered** | Complete! ✅ | Nothing - celebrate! |
| **❌ Cancelled** | Job failed | Check reason, contact customer |

---

## 🔢 The 4 Verification Steps

Every job needs these confirmed (in order):

```
1. Sender gives package to driver
   ↓
2. Driver confirms they have it
   ↓
3. Driver arrives at destination
   ↓
4. Recipient confirms they received it
```

**Each step shows:**
- ✓ Green check = Done
- ⏳ Waiting icon = Pending
- Security Code = OTP number

---

## 🟡 Override Step Button

**When you see "Override Step"** (yellow button):

### Before Clicking:
1. **Call the person** (sender/driver/recipient)
2. **Confirm verbally** what happened
3. **Type a note** explaining why (e.g., "Called sender, confirmed driver picked up package at 2:15pm")
4. **Then click** "Override Step"

### What It Does:
- Marks that step as complete
- Records current timestamp
- Saves your note to audit log
- Moves job to next stage

**Remember**: Always add a note first! It's for compliance.

---

## 🔴 How to Cancel a Job

### Step-by-Step:
1. Scroll down on left side
2. See red box "Job can't be completed?"
3. Click **"Cancel Job"** button
4. Select reason from dropdown
5. If "Other", type explanation
6. Click confirm

### Common Reasons:
- Sender not available (no-show)
- Recipient refused package
- Security denied driver entry
- Address doesn't exist
- Weather/road conditions unsafe

**Note**: Cancelled jobs stay in system with reason logged.

---

## 🎨 Color Code Guide

| Color | Meaning | Example |
|-------|---------|---------|
| 🟢 Green | Success/Complete | "✓ Verified & Complete" |
| 🟡 Yellow | Caution/Manual action | "Override Step" button |
| 🟠 Orange | Warning/Attention | Emergency control panel |
| 🔵 Blue | Information/Help | Help boxes with tips |
| 🔴 Red | Danger/Cancel | Cancel job button |
| ⚪ Gray | Disabled/Inactive | Steps not yet reached |

---

## 📝 Required vs Optional Notes

### Required Notes (Must fill):
- **When using Emergency Status Control**
  - "Reason for Manual Update" field
  - Example: "Customer confirmed by phone, SMS verification failed"

### Optional Notes (Good practice):
- **When overriding individual steps**
  - Per-step note field
  - Example: "Driver called from gate, recipient unavailable"

**Pro tip**: More detail = easier to investigate issues later!

---

## ⚡ Quick Actions Toolbar

| Button | What It Does |
|--------|--------------|
| **Copy Link** | Copies verification link to send via WhatsApp |
| **Open** | Opens verification page in new tab |
| **Save** | Saves note to job audit log |
| **Undo** | Reverses an override (use if mistake) |

---

## 🛡️ Security Code (OTP)

**What it is**: One-time password for verification  
**Where you see it**: Next to "⏳ Waiting"  
**Example**: "Security Code: 152575"

### When to Share It:
- Customer/driver can't open the link
- Phone verification needed
- Backup verification method

### How to Use:
1. Read the 6-digit code to them
2. They confirm they have the package
3. You can then override the step manually

---

## 📞 Emergency Decision Tree

```
Is customer/driver responding?
├─ YES → Let them use normal verification (don't override)
└─ NO
   ├─ Did you call them? 
   │  ├─ NO → Call them first!
   │  └─ YES
   │     ├─ Did they confirm verbally?
   │     │  ├─ YES → Use Emergency Control, add note
   │     │  └─ NO → Wait or escalate to supervisor
```

---

## 🎯 Common Mistakes to Avoid

| ❌ Don't | ✅ Do Instead |
|---------|---------------|
| Click Override without calling | Always call first, then override |
| Use Emergency Control routinely | Only when truly stuck |
| Skip adding notes | Always explain why |
| Panic if something looks wrong | Check this guide first |
| Guess which button to click | Read the label, check color |
| Override all steps at once | Do one step at a time as confirmed |

---

## 📱 WhatsApp Quick Buttons

You'll see three dispatch buttons:

| Button | Sends To | Purpose |
|--------|----------|---------|
| **Sender Dsp.** | Sender/Customer | Confirms pickup details |
| **Pilot Dsp.** | Driver | Job assignment notification |
| **Client Dsp.** | Recipient | Delivery notification |

**Status indicators:**
- "Ready" (blue) = Not sent yet
- "Dispatched" (gray) = Already sent

**Tip**: Click these to auto-send WhatsApp messages with tracking links!

---

## 🔍 Troubleshooting Guide

### "Button is grayed out"
→ That step is disabled because prerequisites aren't met

### "Can't click Override Step"
→ Add a note in the text field first

### "Status won't update"
→ Check your internet connection, try refreshing

### "Wrong status applied"
→ Use "Undo" button, then reapply correct status

### "Don't know which button to press"
→ When in doubt, DON'T press anything - ask supervisor

---

## 📥 Download Proof of Delivery

**When available**: After step 4 is complete  
**Button location**: Bottom right panel  
**Button says**: "Download Proof of Delivery (PDF)"

**What it includes:**
- All 4 verification timestamps
- Driver details
- Sender/recipient signatures (if captured)
- OTP codes used
- GPS coordinates (if available)

**Use for**: Customer proof, billing, disputes

---

## 🆘 Who to Ask for Help

| Issue Type | Ask |
|------------|-----|
| "How do I...?" | This guide or team lead |
| System not working | IT/Technical support |
| Customer complaint | Supervisor |
| Driver not responding | Dispatch coordinator |
| Billing question | Accounts team |
| Unsure if should override | **Always ask supervisor** |

---

## ⏱️ Response Time Guidelines

| Job Urgency | Max Wait Before Override |
|-------------|--------------------------|
| **Emergency** | 15 minutes of trying |
| **Today** | 30 minutes of trying |
| **Scheduled** | 60 minutes of trying |
| **Standard** | 2 hours of trying |

**"Trying" means**: 2+ phone calls, WhatsApp messages, and attempted contact

---

## 💡 Pro Tips

1. **Keep notes concise but clear**
   - Bad: "ok"
   - Good: "Customer confirmed 2:30pm via phone call"

2. **Use emojis as visual cues**
   - ⏳ = Still waiting
   - ✓ = Done
   - ⚠️ = Need attention

3. **Double-check before Override**
   - Is the note clear?
   - Did I really try to contact them?
   - Am I clicking the right status?

4. **Trust the colors**
   - Yellow = pause and think
   - Red = serious action
   - Green = safe to proceed

5. **When in doubt, wait**
   - Better to delay 10 minutes than cancel wrongly
   - Most issues resolve themselves

---

## 📊 Your Daily Checklist

### Morning:
- [ ] Check 1️⃣ Pending jobs - assign drivers
- [ ] Review any 🟡 yellow alerts
- [ ] Follow up on yesterday's issues

### During Day:
- [ ] Monitor 3️⃣ In Transit jobs
- [ ] Respond to driver messages within 5 min
- [ ] Update statuses as they happen

### End of Day:
- [ ] Ensure no jobs stuck at 4️⃣ Arrived
- [ ] Document any overrides used
- [ ] Report patterns to supervisor

---

## 🎓 Remember

**The Three Rules:**
1. **Call first, override second**
2. **Always add a note**
3. **Yellow means caution**

**You've got this!** 💪

---

*Questions? Problems? Ask your supervisor - that's what they're there for!*

---

**Last Updated**: [Current Date]  
**Print this page** and keep it at your desk!
