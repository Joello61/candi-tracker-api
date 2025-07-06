import { Twilio } from 'twilio';
import { config } from './env';

// Configuration Twilio
export const createSMSClient = () => {
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    console.warn('Configuration Twilio manquante, SMS désactivés');
    return null;
  }
  
  return new Twilio(config.twilioAccountSid, config.twilioAuthToken);
};

// Templates SMS
export const smsTemplates = {
  interviewReminder: (data: any) => 
    `🎯 Rappel: Entretien ${data.company} ${data.type} dans ${data.timeUntil}. Date: ${data.date}. Bonne chance!`,
  
  applicationDeadline: (data: any) => 
    `⏰ Rappel: Date limite candidature ${data.company} dans ${data.timeUntil}!`,
  
  quickUpdate: (data: any) => 
    `📱 Job Tracker: ${data.message}`
};