export default {
  common: {
    success: 'تم بنجاح',
    error: 'حدث خطأ ما.',
    permission: 'ليس لديك صلاحية لاستخدام هذا الأمر.',
    noTarget: 'يرجى تحديد مستخدم صحيح.',
    noPermission: 'ليس لديك صلاحية لاستخدام هذا الأمر.',
    cannotBan: 'لا يمكنني حظر هذا المستخدم بسبب ترتيب الرتب أو نقص الصلاحيات.',
  },
  moderation: {
    ban: {
      success: 'تم حظر المستخدم {target} بسبب: {reason}',
      noReason: 'لا يوجد سبب.',
    },
    kick: {
      success: 'تم طرد المستخدم {target} بسبب: {reason}',
    },
    timeout: {
      success: 'تم حظر المستخدم {target} لمدة {duration} دقيقة.',
    },
    purge: {
      success: 'تم حذف {count} رسالة.',
    },
  },
  utility: {
    ping: 'بوغ! زمن الاستجابة: {latency}ms',
  },
  language: {
    updated: 'ستُستخدم {language} كلغة لهذا الخادم الآن.',
    english: 'الإنجليزية',
    arabic: 'العربية',
    guildOnly: 'يمكن استخدام هذا الأمر داخل الخادم فقط.',
  },
  economy: {
    disabled: 'نظام الاقتصاد معطل في هذا الخادم.',
    balance: 'لدى {user} {wallet} {currency} في المحفظة و{bank} {currency} في البنك.',
    daily: 'حصلت على {amount} {currency}. عُد بعد 24 ساعة.',
    dailyCooldown: 'يمكنك استلام المكافأة اليومية بعد {hours} ساعة و{minutes} دقيقة.',
    work: 'حصلت على {amount} {currency}.',
    workCooldown: 'يمكنك العمل مجدداً بعد {minutes} دقيقة.',
    transfer: 'تم تحويل {amount} {currency} إلى {user}.',
    transferSelf: 'لا يمكنك تحويل العملات إلى نفسك.',
    recipientNotMember: 'يجب أن يكون المستلم عضواً في هذا الخادم.',
    insufficientFunds: 'رصيد محفظتك غير كافٍ.',
    invalidAmount: 'أدخل مبلغاً أكبر من صفر.',
    profileError: 'تعذر تحميل ملفك الاقتصادي.',
  },
  music: {
    queued: 'تمت إضافة: {title}',
  },
};
