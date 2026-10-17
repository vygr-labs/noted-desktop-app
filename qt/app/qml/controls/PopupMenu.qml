import QtQuick
import QtQuick.Controls.Basic
import Noted

// A MenuBase with one submenu for rows that have `children`. See MenuBase
// for the item format.
MenuBase {
    id: root
    sub: subMenu
    property MenuBase subMenu: MenuBase { isSub: true; parentMenu: root; closePolicy: Popup.CloseOnEscape }
}
