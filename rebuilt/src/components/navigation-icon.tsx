import {LayoutDashboard,Bell,Users,GraduationCap,CalendarDays,ClipboardCheck,UserCheck,HeartHandshake,Wallet,Landmark,Award,BookOpenCheck,FileText,School,Library,ClipboardList,ChartNoAxesCombined,Settings,Network,KeyRound,ListTodo,Database,Contact,UserRound,MailCheck,ShieldCheck,MonitorSmartphone,ScanFace,Layers,type LucideIcon} from "lucide-react";
const icons:Record<string,LucideIcon>={
 "/account":LayoutDashboard,"/account/services/notifications":Bell,"/account/directory":Users,"/account/classes":GraduationCap,"/account/schedules":CalendarDays,
 "/account/operations/duty":ClipboardCheck,"/account/operations/attendance":UserCheck,"/account/operations/mentoring":HeartHandshake,"/account/operations/fees":Wallet,"/account/operations/savings":Landmark,"/account/services/discipline":Award,
 "/account/learning/grades":BookOpenCheck,"/account/learning/reports":FileText,"/account/learning/promotions":School,"/account/learning/books":Library,
 "/account/services/surveys":ClipboardList,"/account/services/insights":ChartNoAxesCombined,"/account/settings":Settings,"/account/families":Network,"/account/recovery":KeyRound,"/account/services/jobs":ListTodo,"/account/services/reconciliation":Database,
 "/account/biodata":Contact,"/account/profile":UserRound,"/account/email":MailCheck,"/account/security":ShieldCheck,"/account/sessions":MonitorSmartphone,"/account/access":ScanFace,
};
export function NavigationIcon({href}:{href:string}){const Icon=icons[href]??Layers;return <Icon className="navigation-icon" strokeWidth={1.7} aria-hidden="true"/>;}
